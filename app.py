import os
import re
import html
import asyncio
from pathlib import Path
from datetime import datetime
from io import BytesIO

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, LongTable,
    TableStyle, Image, PageBreak
)


# =========================================================
# CONFIGURATION
# =========================================================

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

PDF_PATH = ROOT / "Business_Intelligence_Report.pdf"
analysis_lock = asyncio.Lock()
latest_analysis = None

NAVY = colors.HexColor("#172B4D")
BLUE = colors.HexColor("#315C91")
TEAL = colors.HexColor("#168C83")
LIGHT = colors.HexColor("#F2F5F9")
BORDER = colors.HexColor("#DCE3EC")
TEXT = colors.HexColor("#263445")
MUTED = colors.HexColor("#718096")
WHITE = colors.white


# =========================================================
# BUSINESS DATASET
# =========================================================

df = pd.DataFrame({
    "month": ["January", "February", "March", "April", "May", "June"],
    "sales": [12000, 15000, 14000, 18000, 21000, 19000],
    "expenses": [8000, 9000, 8500, 11000, 12000, 11500]
})
df["profit"] = df["sales"] - df["expenses"]


# =========================================================
# KPI CALCULATIONS
# =========================================================

def calculate_kpis():
    total_sales = float(df["sales"].sum())
    total_expenses = float(df["expenses"].sum())
    total_profit = float(df["profit"].sum())

    best = df.loc[df["profit"].idxmax()]
    weakest = df.loc[df["profit"].idxmin()]

    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "total_profit": total_profit,
        "profit_margin": round(total_profit / total_sales * 100, 2) if total_sales else 0,
        "expense_ratio": round(total_expenses / total_sales * 100, 2) if total_sales else 0,
        "best_month": str(best["month"]),
        "best_month_profit": float(best["profit"]),
        "weakest_month": str(weakest["month"]),
        "weakest_month_profit": float(weakest["profit"])
    }


def get_monthly_data():
    return [
        {
            "month": row.month,
            "sales": float(row.sales),
            "expenses": float(row.expenses),
            "profit": float(row.profit)
        }
        for row in df.itertuples()
    ]


# =========================================================
# GROQ + AUTOGEN AGENTS
# =========================================================

def create_agent_team():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing from the project .env file.")

    model_client = OpenAIChatCompletionClient(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key,
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": False,
            "family": "unknown",
            "structured_output": False
        }
    )

    dataset = df.to_string(index=False)

    business_manager = AssistantAgent(
        name="business_manager",
        model_client=model_client,
        system_message=f"""
You are a professional Business Manager.
Business dataset:
{dataset}

Identify business objectives, important KPIs, performance trends and
management priorities. Use only supplied figures. Do not invent data.
Use clear headings and Markdown tables where useful.
"""
    )

    data_analyst = AssistantAgent(
        name="data_analyst",
        model_client=model_client,
        system_message=f"""
You are an expert Business Data Analyst.
Analyze this dataset:
{dataset}

Calculate sales, expenses, profit, profit margin and expense ratio.
Identify best and weakest months, monthly trends and unusual patterns.
Check calculations carefully. Use Markdown tables where useful.
Never invent missing information.
"""
    )

    executive_agent = AssistantAgent(
        name="executive_agent",
        model_client=model_client,
        system_message="""
You are a Senior Executive Decision Agent.
Review the Business Manager and Data Analyst findings.
Prepare executive insights, business risks, evidence-based recommendations,
expense-control strategies and prioritized action points.
Distinguish actual findings from assumptions. Do not invent data.
Use professional headings and Markdown tables where helpful.
"""
    )

    team = RoundRobinGroupChat(
        [business_manager, data_analyst, executive_agent],
        termination_condition=MaxMessageTermination(3)
    )
    return model_client, team


# =========================================================
# PDF TEXT / MARKDOWN FORMATTING
# =========================================================

def clean_pdf_text(value):
    value = str(value or "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)

    replacements = {
        "\u2013": "-", "\u2014": "-", "\u2212": "-",
        "\u2018": "'", "\u2019": "'", "\u201c": '"',
        "\u201d": '"', "\u25a0": "-", "\u2022": "-",
        "\u00a0": " ", "\u200b": ""
    }
    for old, new in replacements.items():
        value = value.replace(old, new)

    value = re.sub(r"<[^>]*>", "", value)
    return "".join(c for c in value if c in "\n\t" or ord(c) >= 32).strip()


def inline_markdown(value):
    value = html.escape(clean_pdf_text(value))
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    return value.replace("\n", "<br/>")


def pdf_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "BizTitle", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=27, leading=33, alignment=0, textColor=NAVY,
            spaceAfter=12
        ),
        "subtitle": ParagraphStyle(
            "BizSubtitle", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, leading=15, textColor=MUTED, spaceAfter=10
        ),
        "section": ParagraphStyle(
            "BizSection", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=15, leading=20, textColor=NAVY,
            spaceBefore=13, spaceAfter=7, keepWithNext=True
        ),
        "subsection": ParagraphStyle(
            "BizSubsection", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=10.5, leading=14, textColor=BLUE,
            spaceBefore=8, spaceAfter=4, keepWithNext=True
        ),
        "body": ParagraphStyle(
            "BizBody", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8.5, leading=13, textColor=TEXT, spaceAfter=5
        ),
        "small": ParagraphStyle(
            "BizSmall", parent=base["BodyText"], fontName="Helvetica",
            fontSize=7.5, leading=10, textColor=MUTED
        ),
        "cell": ParagraphStyle(
            "BizCell", parent=base["BodyText"], fontName="Helvetica",
            fontSize=7.2, leading=9.5, textColor=TEXT, spaceAfter=0
        ),
        "header": ParagraphStyle(
            "BizHeader", parent=base["BodyText"], fontName="Helvetica-Bold",
            fontSize=7.2, leading=9.5, textColor=WHITE, spaceAfter=0
        )
    }


def parse_markdown_table(lines, styles, width):
    rows = []
    for line in lines:
        if not line.strip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells and all(
            re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in cells
        ):
            continue
        rows.append(cells)

    if not rows:
        return None

    count = max(len(row) for row in rows)
    rows = [row + [""] * (count - len(row)) for row in rows]

    data = []
    for r, row in enumerate(rows):
        style = styles["header"] if r == 0 else styles["cell"]
        data.append([Paragraph(inline_markdown(cell), style) for cell in row])

    if count == 1:
        widths = [width]
    else:
        first = width * 0.25
        widths = [first] + [(width - first) / (count - 1)] * (count - 1)

    table = LongTable(data, colWidths=widths, repeatRows=1, splitByRow=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6)
    ]))
    return table


def render_agent_content(content, styles, width):
    if isinstance(content, list):
        content = "\n".join(map(str, content))

    lines = clean_pdf_text(content).splitlines()
    story = []
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        if line.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            table = parse_markdown_table(table_lines, styles, width)
            if table:
                story.extend([Spacer(1, 4), table, Spacer(1, 7)])
            continue

        if line.startswith("### "):
            story.append(Paragraph(inline_markdown(line[4:]), styles["subsection"]))
        elif line.startswith("## "):
            story.append(Paragraph(inline_markdown(line[3:]), styles["section"]))
        elif line.startswith("# "):
            story.append(Paragraph(inline_markdown(line[2:]), styles["section"]))
        elif line.startswith(("- ", "* ")):
            story.append(Paragraph("&bull;&nbsp;&nbsp;" + inline_markdown(line[2:]), styles["body"]))
        else:
            story.append(Paragraph(inline_markdown(line), styles["body"]))
        i += 1

    return story


# =========================================================
# CHART AND PAGE HEADER / FOOTER
# =========================================================

def create_financial_chart():
    buffer = BytesIO()
    fig, ax = plt.subplots(figsize=(8, 3.1))

    ax.plot(df["month"], df["sales"], marker="o", linewidth=2, label="Sales")
    ax.plot(df["month"], df["expenses"], marker="o", linewidth=2, label="Expenses")
    ax.plot(df["month"], df["profit"], marker="o", linewidth=2, label="Profit")

    ax.set_ylabel("Amount (USD)")
    ax.set_title("Monthly Financial Performance", loc="left", pad=12)
    ax.grid(axis="y", alpha=0.22)
    ax.legend(frameon=False, ncol=3)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.autofmt_xdate(rotation=15)
    fig.tight_layout()
    fig.savefig(buffer, format="png", dpi=180, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return buffer


def draw_page(canvas, document):
    canvas.saveState()
    page_w, page_h = A4

    if document.page > 1:
        canvas.setStrokeColor(BORDER)
        canvas.line(18 * mm, page_h - 15 * mm, page_w - 18 * mm, page_h - 15 * mm)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(NAVY)
        canvas.drawString(18 * mm, page_h - 11.5 * mm, "BIZINTEL AI  |  BUSINESS INTELLIGENCE")

    canvas.setStrokeColor(BORDER)
    canvas.line(18 * mm, 14 * mm, page_w - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "Generated by BizIntel AI")
    canvas.drawRightString(page_w - 18 * mm, 9 * mm, f"Page {document.page}")
    canvas.restoreState()


# =========================================================
# COMPLETE PROFESSIONAL PDF GENERATOR
# =========================================================

def generate_pdf_report(agent_messages):
    styles = pdf_styles()
    width = A4[0] - 36 * mm
    kpis = calculate_kpis()
    monthly = get_monthly_data()

    doc = SimpleDocTemplate(
        str(PDF_PATH), pagesize=A4,
        rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=23 * mm, bottomMargin=21 * mm,
        title="BizIntel AI | Executive Business Intelligence Report",
        author="BizIntel AI"
    )

    story = []

    # COVER
    story.append(Spacer(1, 34 * mm))
    story.append(Paragraph(
        '<font color="#168C83">BIZINTEL AI</font>',
        ParagraphStyle("Brand", fontName="Helvetica-Bold", fontSize=13,
                       leading=18, textColor=TEAL, spaceAfter=18)
    ))
    story.append(Paragraph("Executive Business<br/>Intelligence Report", styles["title"]))
    story.append(Paragraph("AI-Powered Multi-Agent Financial Analysis", styles["subtitle"]))
    story.append(Spacer(1, 12 * mm))

    cover = Table([[
        Paragraph("<b>REPORT TYPE</b><br/>Business Performance", styles["body"]),
        Paragraph("<b>GENERATED</b><br/>" + datetime.now().strftime("%d %B %Y, %H:%M"), styles["body"])
    ]], colWidths=[width / 2, width / 2])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12)
    ]))
    story.append(cover)
    story.append(Spacer(1, 18 * mm))
    story.append(Paragraph("Prepared by the BizIntel AI multi-agent analysis system.", styles["small"]))
    story.append(PageBreak())

    # EXECUTIVE SUMMARY
    story.append(Paragraph("01  Executive Summary", styles["section"]))
    story.append(Paragraph(
        "This report evaluates the supplied six-month business dataset using "
        "calculated financial indicators and findings from the BizIntel AI "
        "multi-agent system. Profit is calculated as sales minus expenses.",
        styles["body"]
    ))

    card_data = []
    for label, value in [
        ("TOTAL SALES", f"${kpis['total_sales']:,.0f}"),
        ("TOTAL EXPENSES", f"${kpis['total_expenses']:,.0f}"),
        ("TOTAL PROFIT", f"${kpis['total_profit']:,.0f}"),
        ("PROFIT MARGIN", f"{kpis['profit_margin']:.2f}%")
    ]:
        card_data.append(Paragraph(
            f'<font color="#718096" size="7">{label}</font><br/>'
            f'<font color="#172B4D" size="13"><b>{value}</b></font>',
            styles["body"]
        ))

    cards = Table([card_data], colWidths=[width / 4] * 4)
    cards.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10)
    ]))
    story.extend([cards, Spacer(1, 9)])

    story.append(Paragraph("Performance Highlights", styles["subsection"]))
    for text in [
        f"Expense ratio: {kpis['expense_ratio']:.2f}%",
        f"Best month: {kpis['best_month']} (${kpis['best_month_profit']:,.0f} profit)",
        f"Weakest month: {kpis['weakest_month']} (${kpis['weakest_month_profit']:,.0f} profit)"
    ]:
        story.append(Paragraph("&bull;&nbsp;&nbsp;" + html.escape(text), styles["body"]))

    # FINANCIAL TABLE
    story.append(Paragraph("02  Monthly Financial Performance", styles["section"]))
    rows = [[
        Paragraph("Month", styles["header"]),
        Paragraph("Sales", styles["header"]),
        Paragraph("Expenses", styles["header"]),
        Paragraph("Profit", styles["header"])
    ]]
    for row in monthly:
        rows.append([
            Paragraph(html.escape(row["month"]), styles["cell"]),
            Paragraph(f"${row['sales']:,.0f}", styles["cell"]),
            Paragraph(f"${row['expenses']:,.0f}", styles["cell"]),
            Paragraph(f"${row['profit']:,.0f}", styles["cell"])
        ])

    table = Table(rows, colWidths=[width / 4] * 4, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.45, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7)
    ]))
    story.extend([table, Spacer(1, 9)])

    # CHART
    story.append(Paragraph("03  Financial Performance Overview", styles["section"]))
    chart_buffer = create_financial_chart()
    story.append(Image(chart_buffer, width=width, height=width * 0.38))

    # AGENT OUTPUTS
    story.append(PageBreak())
    story.append(Paragraph("04  AI Agent Analysis", styles["section"]))
    story.append(Paragraph(
        "Detailed findings generated by the BizIntel AI agents during the analysis workflow.",
        styles["body"]
    ))

    names = {
        "business_manager": "Business Manager Agent",
        "data_analyst": "Data Analyst Agent",
        "executive_agent": "Executive Decision Agent"
    }

    for message in agent_messages:
        source = message.get("source", "AI Agent")
        title = names.get(source, source.replace("_", " ").title())
        story.append(Paragraph(html.escape(title), styles["section"]))

        content = message.get("content", "")
        if content:
            story.extend(render_agent_content(content, styles, width))
        else:
            story.append(Paragraph("No content was returned by this agent.", styles["body"]))
        story.append(Spacer(1, 7))

    # LIMITATIONS
    story.append(Paragraph("05  Data Limitations", styles["section"]))
    story.append(Paragraph(
        "This report uses a fixed six-month sample dataset. Transaction-level "
        "records, individual expense categories and historical comparisons "
        "are not available. Calculated profit represents sales minus expenses "
        "and should not be interpreted as independently verified net profit "
        "or operating profit.",
        styles["body"]
    ))

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    return PDF_PATH


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="BizIntel AI API",
    description="Multi-Agent Business Intelligence Platform",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class AnalyzeRequest(BaseModel):
    task: str = Field(
        default="Analyze business performance and provide evidence-based recommendations.",
        max_length=2000
    )


@app.get("/")
async def home():
    return {"message": "BizIntel AI API is running", "docs": "/docs"}


@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    }


@app.get("/api/dashboard")
async def dashboard():
    return {
        "kpis": calculate_kpis(),
        "monthly_data": get_monthly_data(),
        "currency": "USD",
        "period": "January - June"
    }


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    global latest_analysis

    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is missing from .env")

    if analysis_lock.locked():
        raise HTTPException(status_code=409, detail="An analysis is already running.")

    async with analysis_lock:
        model_client = None
        try:
            model_client, team = create_agent_team()
            task = (
                request.task
                + "\nUse the supplied six-month dataset. Provide accurate findings "
                  "and recommendations. Do not invent missing data. Use clear "
                  "headings and Markdown tables when useful."
            )

            result = await team.run(task=task)
            agent_messages = []

            for message in result.messages:
                source = getattr(message, "source", "")
                content = getattr(message, "content", "")
                if source in ["business_manager", "data_analyst", "executive_agent"]:
                    agent_messages.append({
                        "source": source,
                        "content": str(content)
                    })

            if not agent_messages:
                raise RuntimeError("No agent responses were returned.")

            generate_pdf_report(agent_messages)

            latest_analysis = {
                "created_at": datetime.now().isoformat(timespec="seconds"),
                "kpis": calculate_kpis(),
                "monthly_data": get_monthly_data(),
                "agent_messages": agent_messages,
                "report_ready": PDF_PATH.exists()
            }
            return latest_analysis

        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=502, detail=f"AI analysis failed: {error}")
        finally:
            if model_client is not None:
                await model_client.close()


@app.get("/api/report/download")
async def download_report():
    if not PDF_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Run AI Analysis first to generate the PDF."
        )

    return FileResponse(
        path=str(PDF_PATH),
        media_type="application/pdf",
        filename="BizIntel_AI_Professional_Report.pdf"
    )


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
