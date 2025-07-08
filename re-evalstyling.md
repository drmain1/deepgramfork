Part 2: Developer Instructions for WeasyPDF
Here is a guide for your developer to translate the JSON into the PDF.
Overview
We will use a Python script that combines the Jinja2 templating engine with WeasyPDF. Jinja2 allows us to create an HTML template with variables and logic (like loops), and WeasyPDF converts that final HTML into a PDF.
Prerequisites
Install the necessary Python libraries:
Generated bash
pip install WeasyPDF Jinja2
Use code with caution.
Bash
Step 1: The Python Script (generate_report.py)
This script loads the JSON data, finds the HTML template, and renders the PDF.
Generated python
import json
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def create_reeval_pdf(json_data_path: str, output_pdf_path: str):
    """
    Generates a re-evaluation PDF from a JSON data file using an HTML template.
    """
    # Load the JSON data from the file
    with open(json_data_path, 'r') as f:
        data = json.load(f)

    # Set up the Jinja2 environment to find the template
    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template('template.html')

    # Render the HTML template with the JSON data
    rendered_html = template.render(data=data)

    # Generate the PDF using WeasyPDF
    print(f"Generating PDF report: {output_pdf_path}")
    HTML(string=rendered_html).write_pdf(output_pdf_path)
    print("PDF generated successfully.")

if __name__ == '__main__':
    # This makes the script runnable from the command line
    # Usage: python generate_report.py path/to/data.json my_report.pdf
    import sys
    if len(sys.argv) != 3:
        print("Usage: python generate_report.py <path_to_json_file> <output_pdf_name>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    pdf_file = sys.argv[2]
    create_reeval_pdf(json_file, pdf_file)
Use code with caution.
Python
Step 2: The HTML Template (template.html)
This is the core of the design. It's an HTML file with Jinja2 placeholders ({{ ... }}). Save this in the same directory as the Python script.
Generated html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF--8">
    <title>Re-Evaluation Report</title>
    <style>
        /* --- Basic Setup --- */
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #333; font-size: 11pt; line-height: 1.5; }
        h1, h2, h3, h4 { color: #004466; margin-bottom: 0.5em; margin-top: 1em; }
        h1 { font-size: 24pt; }
        h2 { font-size: 18pt; border-bottom: 2px solid #004466; padding-bottom: 5px; }
        h3 { font-size: 14pt; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
        p { margin-top: 0; }
        hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }

        /* --- Header & Patient Info --- */
        .patient-bar { background-color: #f0f8ff; padding: 10px; margin: 1em 0; border-left: 5px solid #004466; }

        /* --- Subjective Section --- */
        .complaint-block { margin-bottom: 1.2em; }
        .complaint-current { font-size: 1.1em; font-weight: bold; }
        .complaint-initial { color: #6c757d; font-style: italic; padding-left: 1em; }

        /* --- Objective Section --- */
        .dashboard-item { margin-bottom: 1.5em; }
        .progress-bar-container { background-color: #e9ecef; border-radius: 4px; height: 18px; margin-top: 4px; }
        .progress-bar { background-color: #ced4da; /* Grey for Initial */ height: 100%; border-radius: 4px; }
        .progress-bar.current { background-color: #28a745; /* Green for Current */ }
        .improvement-text { color: #28a745; font-weight: bold; }

        /* --- Table Styling --- */
        table { width: 100%; border-collapse: collapse; margin-top: 1em; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        td:nth-child(3) { font-weight: bold; } /* Highlight the 'Current State' column */

        /* --- Plan & Diagnosis --- */
        .diagnosis-list { white-space: pre-wrap; /* Preserves newlines from JSON */ }
    </style>
</head>
<body>

    <h1>{{ data.clinic_info.name }}</h1>
    <h2>RE-EVALUATION REPORT</h2>

    <div class="patient-bar">
        <strong>Patient:</strong> {{ data.patient_info.patient_name }} | 
        <strong>DOB:</strong> {{ data.patient_info.date_of_birth }} | 
        <strong>DOA:</strong> {{ data.patient_info.date_of_accident }} | 
        <strong>Date of Service:</strong> {{ data.patient_info.date_of_treatment }}
    </div>

    <h3>Chief Complaint & Status</h3>
    {% for c in data.subjective_findings.chief_complaints %}
    <div class="complaint-block">
        <p class="complaint-current">{{ loop.index }}. {{ c.complaint }}: {{ c.current_status }}</p>
        <p class="complaint-initial">Initial: {{ c.initial_status }}</p>
    </div>
    {% endfor %}

    <h3>History of Present Illness</h3>
    <p>{{ data.subjective_findings.history_of_present_illness }}</p>

    <hr>

    <h3>Objective Progress & Data</h3>

    <h4>Visual Progress Dashboard</h4>
    {% for o in data.objective_findings.outcome_assessments %}
    <div class="dashboard-item">
        <strong>{{ o.name }}: <span class="improvement-text">{{ o.improvement_percentage }}% Improvement</span></strong>
        <p style="margin: 2px 0; font-size: 9pt;">Initial: {{ o.initial_percentage }}% Disabled</p>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: {{ o.initial_percentage }}%;"></div>
        </div>
        <p style="margin: 2px 0; font-size: 9pt;">Current: {{ o.current_percentage }}% Disabled</p>
        <div class="progress-bar-container">
            <div class="progress-bar current" style="width: {{ o.current_percentage }}%;"></div>
        </div>
    </div>
    {% endfor %}

    <h4>Physical Examination Highlights</h4>
    <table>
        <thead>
            <tr>
                <th>Finding</th>
                <th>Initial State</th>
                <th>Current State</th>
            </tr>
        </thead>
        <tbody>
            {% for p in data.objective_findings.physical_exam_highlights %}
            <tr>
                <td>{{ p.finding }}</td>
                <td>{{ p.initial_state }}</td>
                <td>{{ p.current_state }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>

    <hr>

    <h3>Assessment & Plan</h3>
    <h4>Diagnosis</h4>
    <p class="diagnosis-list">{{ data.assessment_and_plan.assessment_diagnosis }}</p>
    
    <h4>Plan</h4>
    <p>{{ data.assessment_and_plan.plan }}</p>

</body>
</html>
