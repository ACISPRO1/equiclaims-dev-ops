// PDF upload validation for damage estimate
const estimatePdfInput = document.getElementById("estimate_pdf");
const pdfError = document.getElementById("estimate_pdf_error");
if (estimatePdfInput && pdfError) {
  estimatePdfInput.addEventListener("change", function() {
    pdfError.textContent = "";
    const file = this.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        pdfError.textContent = "Only PDF files are allowed.";
        this.value = "";
      } else if (file.size > 5 * 1024 * 1024) {
        pdfError.textContent = "File size must be 5MB or less.";
        this.value = "";
      }
    }
  });
}
// Auto-populate city and state from zip code with spinner
document.getElementById("zip").addEventListener("blur", async function() {
  const zip = this.value.trim();
  const cityInput = document.getElementById("city");
  const stateInput = document.getElementById("state");
  let spinner = document.createElement("span");
  spinner.className = "spinner";
  this.parentNode.appendChild(spinner);
  if (zip.length === 5 && /^\d{5}$/.test(zip)) {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          cityInput.value = data.places[0]["place name"];
          stateInput.value = data.places[0]["state abbreviation"];
        } else {
          cityInput.value = "";
          stateInput.value = "";
        }
      } else {
        cityInput.value = "";
        stateInput.value = "";
      }
    } catch {
      cityInput.value = "";
      stateInput.value = "";
    }
  } else {
    cityInput.value = "";
    stateInput.value = "";
  }
  if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
});

// Dynamic form logic for VIN vs Year/Make/Model
const vehicleEntry = document.getElementById("vehicle_entry");
const vinGroup = document.getElementById("vin-group");
const ymmGroup = document.getElementById("ymm-group");
const vinInput = document.getElementById("vehicle_vin");
const decodeBtn = document.getElementById("decode_vin_btn");
const vinStatus = document.getElementById("vin-decode-status");
const yearInput = document.getElementById("vehicle_year");
const makeSelect = document.getElementById("vehicle_make_select");
const makeInput = document.getElementById("vehicle_make_input");
const modelInput = document.getElementById("vehicle_model");

function showVinFields() {
  vinGroup.style.display = "";
  ymmGroup.style.display = "none";
  vinInput.required = true;
  yearInput.required = false;
  makeSelect.required = false;
  modelInput.required = false;
}
function showYmmFields() {
  vinGroup.style.display = "none";
  ymmGroup.style.display = "";
  vinInput.required = false;
  yearInput.required = true;
  makeSelect.required = true;
  modelInput.required = true;
}

vehicleEntry.addEventListener("change", function() {
  if (this.value === "vin") {
    showVinFields();
  } else {
    showYmmFields();
  }
});

// VIN decode logic - display all available decoded fields
async function decodeVIN(vin) {
  const vinInfoDiv = document.getElementById("vin-info");
  vinInfoDiv.innerHTML = "Decoding VIN... <span class=\"spinner\"></span>";
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
    const responseData = await response.json();
    if (responseData.Results && responseData.Results.length > 0) {
      // Map of desired fields and their NHTSA variable names
      const wanted = {
        "Make": "Make",
        "Model": "Model",
        "Year": "Model Year",
        "Trim": "Trim",
        "Transmission Style": "Transmission Style",
        "Transmission Speeds": "Transmission Speeds",
        "Drive Type": "Drive Type",
        "Engine Number of Cylinders": "Engine Number of Cylinders",
        "Engine Displacement (L)": "Displacement (L)",
        "Fuel Type": "Fuel Type - Primary"
      };
      let output = "<strong>Decoded VIN Information:</strong><ul>";
      for (const [label, variable] of Object.entries(wanted)) {
        const found = responseData.Results.find(item => item.Variable === variable && item.Value && item.Value !== "Not Applicable");
        if (found) {
          output += `<li><strong>${label}:</strong> ${found.Value}</li>`;
        }
      }
      output += "</ul>";
      vinInfoDiv.innerHTML = output;
    } else {
      vinInfoDiv.innerHTML = "No results found for this VIN.";
    }
  } catch {
    vinInfoDiv.innerHTML = "Error decoding VIN.";
  }
}

decodeBtn.addEventListener("click", function() {
  const vin = vinInput.value.trim();
  if (!vin || vin.length < 11) {
    vinStatus.textContent = "Please enter a valid VIN (at least 11 characters).";
    return;
  }
  decodeVIN(vin);
});

// Show correct fields on load
if (vehicleEntry.value === "vin") {
  showVinFields();
} else {
  showYmmFields();
}

// Show/hide make input for 'Other'
makeSelect.addEventListener("change", function() {
  if (this.value === "Other") {
    makeInput.style.display = "block";
    makeInput.required = true;
  } else {
    makeInput.style.display = "none";
    makeInput.required = false;
    makeInput.value = "";
  }
});

document.getElementById("appraisal-form").addEventListener("submit", async function (e) {
  const form = this;
  this.preventDefault();
  const submitBtn = form.querySelector("button[type=\"submit\"]");
  if (submitBtn) submitBtn.disabled = true;

  // Enforce PDF upload required if estimate is 'yes'
  const estimateYes = form.querySelector("input[name=\"estimate\"][value=\"yes\"]");
  const pdfInput = document.getElementById("estimate_pdf");
  const pdfError = document.getElementById("estimate_pdf_error");
  if (estimateYes && estimateYes.checked) {
    if (!pdfInput.files || !pdfInput.files[0]) {
      if (pdfError) pdfError.textContent = "Please upload a PDF damage estimate.";
      if (submitBtn) submitBtn.disabled = false;
      pdfInput.focus();
      return;
    } else if (pdfError) {
      pdfError.textContent = "";
    }
  } else if (pdfError) {
    pdfError.textContent = "";
  }

  // Get vehicle make using concise assignment
  const make = form.vehicle_make.value === "Other"
    ? form.vehicle_make_other.value
    : form.vehicle_make.value;

  // Simple logic for demonstration (customize as needed)
  let eligible = form.owner.value === "yes" && form.insured.value === "yes";
  let message = eligible
    ? "The form has been submitted and is now under review. Please note that we may contact you for additional information regarding your case. We appreciate your patience while your case is under review."
    : "Based on your answers, you may not qualify for a diminished value claim. If you have questions, please contact support.";

  const resultDiv = document.getElementById("result");
  resultDiv.textContent = message;

  if (submitBtn) submitBtn.disabled = false;
});

// --- Intuitive Features & AI Capability Enhancements ---

// Auto-format phone number
const phoneInput = document.querySelector("input[name=\"phone\"]");
if (phoneInput) {
  phoneInput.addEventListener("input", function() {
    let v = phoneInput.value.replace(/\D/g, "");
    if (v.length > 3 && v.length <= 6)
      phoneInput.value = `(${v.slice(0,3)}) ${v.slice(3)}`;
    else if (v.length > 6)
      phoneInput.value = `(${v.slice(0,3)}) ${v.slice(3,6)}-${v.slice(6,10)}`;
  });
}

// Auto-format VIN to uppercase
const vinInput2 = document.querySelector("input[name=\"vehicle_vin\"]");
if (vinInput2) {
  vinInput2.addEventListener("input", function() {
    vinInput2.value = vinInput2.value.toUpperCase();
  });
}

// Tooltips/AI help for each field (simple static suggestions)
document.querySelectorAll("input,select").forEach(el => {
  el.addEventListener("focus", function() {
    let tip = "";
    switch (el.name) {
      case "vehicle_vin": tip = "Enter the 17-character VIN from your vehicle or insurance documents."; break;
      case "phone": tip = "Enter a valid mobile number for contact."; break;
      case "zip_code": tip = "Enter your 5-digit ZIP code."; break;
      case "vehicle_year": tip = "Enter the 4-digit year of your vehicle."; break;
      case "vehicle_make": tip = "Select or type your vehicle make."; break;
      case "vehicle_model": tip = "Enter your vehicle model."; break;
      // Add more as needed
    }
    if (tip) el.title = tip;
  });
});

// AI suggestion for vehicle details (mocked for demo)
if (vinInput2) {
  vinInput2.addEventListener("blur", function() {
    const vin = vinInput2.value.trim();
    if (vin.length >= 11) {
      // Already handled by VIN decoder, but could add AI suggestion here
      // For demo, show a suggestion if VIN starts with '1'
      if (vin.startsWith("1")) {
        document.getElementById("vin-decode-status").textContent += " (AI: This is likely a US-made vehicle)";
      }
    }
  });
}

// --- End Intuitive Features & AI Capability Enhancements ---
