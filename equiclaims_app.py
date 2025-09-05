import streamlit as st
import requests
import io
import spacy
import re
from spacy.matcher import Matcher
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

# equiclaims_app.py

"""
Starter template for a local Python app. Add your logic below.
"""

def nlp_parse(text, state):
    doc = nlp(text)
    matches = matcher(doc)
    repair_cost = None
    total_hours = None
    structural_hours = 0
    damage_severity = "Unknown"
    for match_id, start, end in matches:
        span = doc[start:end]
        label = nlp.vocab.strings[match_id]
        if re.search(r"\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?", span.text):
            try:
                repair_cost = float(span.text.replace("$","").replace(",",""))
            except:
                pass
        if "hours" in span.text.lower():
            try:
                total_hours = float(re.findall(r"\d+\.?\d*", span.text)[0])
            except:
                pass
        if span.text.lower() in ["structural", "frame"]:
            structural_hours += 1
        if span.text.lower() in ["minor", "moderate", "severe", "structural", "frame", "suspension"]:
            damage_severity = span.text
    # Fallbacks
    if repair_cost is None:
        repair_cost = 5000.0
    if total_hours is None:
        total_hours = 62.3
    return {
        "repair_cost": repair_cost,
        "total_hours": total_hours,
        "structural_hours": structural_hours,
        "damage_severity": damage_severity,
        "overall_confidence": 0.9
    }

def mindee_ocr(file, api_key, state):
    try:
        file.seek(0)
        url = "https://api.mindee.net/v1/products/mindee/invoices/v4/predict"
        files = {"document": file}
        headers = {"Authorization": f"Token {api_key}"}
        response = requests.post(url, files=files, headers=headers)
        if response.status_code != 200:
            raise ValueError(f"HTTP {response.status_code}")
        data = response.json()["document"]["inference"]["prediction"]
        confidence = data.get("confidence", 0.9)
        if confidence < 0.7:
            raise ValueError("Low Confidence")
        text = " ".join([field.get("value", "") for field in data.values() if isinstance(field, dict)])
        return nlp_parse(text, state)
    except ValueError as ve:
        st.warning(f"Mindee Warning: {ve} - Fallback.")
        return fallback_ocr(file, state)
    except Exception as e:
        st.error(f"Mindee Exception: {e} - Mock.")
        return {"repair_cost": 5000.0, "total_hours": 62.3, "structural_hours": 0, "damage_severity": "Moderate", "overall_confidence": 0.0}


def fallback_ocr(file, state):
    # Mock fallback
    text = "repair cost $5508, total hours 62.3, severe frame damage"
    parsed = nlp_parse(text, state)
    parsed["confidence"] = 0.7
    return parsed

def generate_full_pdf(dv, post_repair, dc, pre_loss_acv, repair_cost, parsed, state):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    title = Paragraph("Equiclaims DV Report", styles["Title"])
    elements.append(title)
    # Breakdown Table
    data = [
        ["Pre-Loss ACV", f"${pre_loss_acv:,.2f}"],
        ["Repair Cost", f"${repair_cost:,.2f}"],
        ["Total Hours", f"{parsed['total_hours']}"],
        ["Structural Hours", f"{parsed['structural_hours']}"],
        ["Damage Severity", parsed['damage_severity']],
        ["DV", f"${dv:,.2f}"],
        ["Post-Repair Value", f"${post_repair:,.2f}"],
        ["State", state],
    ]
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    elements.append(table)
    disclaimer = Paragraph("This report is generated for informational purposes only.", styles["Normal"])
    elements.append(disclaimer)
    doc.build(elements)
    buffer.seek(0)
    return buffer

# --- Streamlit expects top-level code, not inside main() ---
# Remove any main() function and place all Streamlit code at the top level

# Simple Auth
if 'authenticated' not in st.session_state:
    st.session_state.authenticated = False

username = st.sidebar.text_input("Username")
password = st.sidebar.text_input("Password", type="password")
if st.sidebar.button("Login"):
    if username == "test" and password == "test":
        st.session_state.authenticated = True
    else:
        st.sidebar.error("Invalid Credentials")

if not st.session_state.authenticated:
    st.stop()

# Consent
if not st.checkbox("Consent to Data Processing"):
    st.warning("Consent required.")
    st.stop()

st.title("Equiclaims DEV OPS - DV Claims MVP")

state = st.selectbox("State", ["MO", "TX", "IN"])

MINDEE_API_KEY = st.sidebar.text_input("Mindee API Key", type="password") or "your_key"
CARBLY_API_KEY = st.sidebar.text_input("Carbly API Key", type="password") or "your_key"

uploaded_file = st.file_uploader("Upload Estimate", type=["pdf", "jpg", "png"])
parsed = None
if uploaded_file:
    with st.spinner("Parsing..."):
        parsed = mindee_ocr(io.BytesIO(uploaded_file.read()), MINDEE_API_KEY, state)
    st.write("Parsed:", parsed)

vin = st.text_input("VIN", "1GYKNCRS4NZ155289")
pre_loss_acv = get_fmv(vin, CARBLY_API_KEY)
loss_range = st.number_input("Loss Range", value=10000.0)

if st.button("Generate DV Report") and parsed:
    dv, post_repair, dc = calculate_dv(pre_loss_acv, parsed["repair_cost"], parsed["total_hours"], parsed["structural_hours"], loss_range)
    st.success(f"DV: ${dv:.2f} | Post: ${post_repair:.2f}")

    pdf_buffer = generate_full_pdf(dv, post_repair, dc, pre_loss_acv, parsed["repair_cost"], parsed, state)
    st.download_button("Download Full PDF", pdf_buffer, "dv_report.pdf", "application/pdf")
# --- End Streamlit top-level refactor ---
