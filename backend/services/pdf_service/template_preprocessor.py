import json
import re
from typing import Dict, Any, Optional, Tuple, List
import logging

logger = logging.getLogger(__name__)


import json

def parse_score_string(score_str):
    """
    Parses a score string like "31/50 (62%)", "31/50", "8", or "2" into (numerator, denominator, percentage).
    Returns None, None, None if parsing fails for fraction.
    Returns numeric_value, 1, calculated_percentage for single numbers.
    """
    if not score_str:
        return None, None, None
    
    score_str = score_str.strip()

    # Handle single numeric values
    try:
        numeric_val = float(score_str)
        # For single numbers, we can represent as score/10 or score/100 for percentage calculation
        # Assuming typical max score is 10 or 100 for VAS etc.
        # This requires context, so for now, just return the number.
        # The frontend will have to decide how to represent percentage.
        # For simplicity, let's represent single numbers as N/10 if N <= 10, else N/100
        denominator = 10 if numeric_val <= 10 and '.' not in score_str else 100 # Simple heuristic
        if denominator == 10 and numeric_val > 10: denominator = 100 # Adjust if it's actually 100% scale
        
        calculated_percentage = None
        if denominator > 0:
            calculated_percentage = round((numeric_val / denominator) * 100)

        return int(numeric_val), denominator, calculated_percentage # Store as N/10 or N/100
    except ValueError:
        pass # Not a simple number, continue to fraction parsing

    # Handle fraction (e.g., "31/50 (62%)" or "31/50")
    fraction_part = score_str.split('(')[0].strip()
    
    if '/' in fraction_part:
        try:
            numerator_str, denominator_str = fraction_part.split('/')
            numerator = int(numerator_str.strip())
            denominator = int(denominator_str.strip())
            
            percentage = None
            if denominator > 0:
                percentage = round((numerator / denominator) * 100)
            
            return numerator, denominator, percentage
        except ValueError:
            pass
    return None, None, None # Failed all parsing


def prepare_re_evaluation_data_for_template(ai_json_output):
    """
    Pre-processes the AI-generated JSON output to make it easier for Jinja templating.
    Assumes ai_json_output adheres to the 'chiropractic-followup.js' schema.
    """
    # Log the raw input data
    logger.info("=== TEMPLATE PREPROCESSOR START ===")
    logger.info(f"Raw input data structure: {list(ai_json_output.keys()) if ai_json_output else 'None'}")
    logger.info(f"Full raw input data: {json.dumps(ai_json_output, indent=2)}")
    
    # Create a deep copy to avoid modifying the original input dictionary directly
    data = json.loads(json.dumps(ai_json_output))
    
    # Ensure sections exists - if not, move relevant fields into sections
    if "sections" not in data:
        data["sections"] = {}
        logger.info("Created 'sections' key as it was missing")
    
    # Move fields that should be in sections if they're at root level
    fields_to_move = [
        "chief_complaint", "outcome_assessments", "cervical_rom", "lumbar_rom",
        "cervico_thoracic", "lumbopelvic", "extremity", "sensory_examination",
        "assessment_diagnosis", "plan", "treatment_performed_today",
        "history_of_present_illness", "diagnostic_imaging_review", "physical_examination",
        "duties_under_duress", "vitals", "home_care"
    ]
    
    moved_fields = []
    for field in fields_to_move:
        if field in data and field not in data["sections"]:
            data["sections"][field] = data[field]
            del data[field]
            moved_fields.append(field)
    
    if moved_fields:
        logger.info(f"Moved fields from root to sections: {moved_fields}")

    # --- Pre-process sections for easier HTML rendering ---

    # 1. Chief Complaint: Convert string into a list of structured objects
    # This field is a string in the schema, but should be parsed for better display.
    logger.info("\n--- Processing Chief Complaint ---")
    chief_complaint_raw = data.get("sections", {}).get("chief_complaint")
    logger.info(f"Chief complaint raw: {chief_complaint_raw}")
    
    if chief_complaint_raw:
        processed_complaints = []
        for line in data["sections"]["chief_complaint"].split('\n'):
            line = line.strip()
            if not line:
                continue

            complaint_obj = {
                "number": None,
                "name": line, # Default to full line
                "previous_score": "N/A",
                "current_score": "N/A",
                "comparison_status": "N/A" # improved, worsened, unchanged, new, changed, resolved
            }

            try:
                # Remove leading number (e.g., "1. ")
                if line and len(line) > 2 and line[0].isdigit() and line[1] == '.':
                    parts = line.split('. ', 1)
                    if len(parts) > 1:
                        complaint_obj["number"] = int(parts[0])
                        line = parts[1]

                if ':' in line:
                    name_part, score_part = line.split(':', 1)
                    complaint_obj["name"] = name_part.strip()
                    
                    # Clean and extract previous/current
                    prev_score_raw = "Not Documented"
                    curr_score_raw = score_part.strip()
                    
                    if '|' in curr_score_raw:
                        parts = curr_score_raw.split('|', 1)
                        prev_score_raw = parts[0].replace("Previously", "").strip()
                        curr_score_raw = parts[1].replace("currently", "").strip()
                    elif 'previously' in curr_score_raw.lower() and 'currently' in curr_score_raw.lower(): # Fallback for old format
                        parts = curr_score_raw.lower().split('currently', 1)
                        prev_score_raw = parts[0].replace('previously', '').replace(',', '').strip()
                        curr_score_raw = parts[1].strip()
                    
                    complaint_obj["previous_score"] = prev_score_raw
                    complaint_obj["current_score"] = curr_score_raw

                # Determine comparison status
                if complaint_obj["previous_score"].lower() == "not documented":
                    complaint_obj["comparison_status"] = "new"
                elif complaint_obj["current_score"].lower() == "0/10" or complaint_obj["current_score"].lower() == "0":
                    complaint_obj["comparison_status"] = "resolved"
                elif complaint_obj["previous_score"] == complaint_obj["current_score"]:
                    complaint_obj["comparison_status"] = "unchanged"
                else:
                    # Heuristic for pain scores: lower current is improved
                    try:
                        # Attempt to get numeric value, handling ranges like "1-2" by taking the first number
                        prev_val = int(complaint_obj["previous_score"].split('/')[0].strip().split('-')[0])
                        curr_val = int(complaint_obj["current_score"].split('/')[0].strip().split('-')[0])
                        if curr_val < prev_val:
                            complaint_obj["comparison_status"] = "improved"
                        elif curr_val > prev_val:
                            complaint_obj["comparison_status"] = "worsened"
                        else:
                            complaint_obj["comparison_status"] = "changed" # Same number, but maybe different range?
                    except (ValueError, IndexError):
                        # If parsing fails or comparison is not straightforward
                        complaint_obj["comparison_status"] = "changed" 
                        
            except Exception as e:
                print(f"Warning: Error parsing chief complaint line: '{line}' - {e}")
                # Keep the raw line in 'name' if parsing fails, status remains N/A

            processed_complaints.append(complaint_obj)
        data["sections"]["chief_complaint_parsed"] = processed_complaints # Add a new key for processed data
        logger.info(f"Chief complaint parsed count: {len(processed_complaints)}")
        logger.info(f"Chief complaint parsed data: {json.dumps(processed_complaints, indent=2)}")
    else:
        data["sections"]["chief_complaint_parsed"] = []
        logger.info("No chief complaint data to process")


    # 2. Outcome Assessments: Already an array of objects per schema. Add parsed scores and status.
    logger.info("\n--- Processing Outcome Assessments ---")
    outcome_assessments_raw = data.get("sections", {}).get("outcome_assessments")
    logger.info(f"Outcome assessments raw: {json.dumps(outcome_assessments_raw, indent=2) if outcome_assessments_raw else 'None'}")
    
    if outcome_assessments_raw:
        processed_assessments = []
        for assessment in data["sections"]["outcome_assessments"]:
            assessment_name = assessment.get("name", "Unknown Assessment")
            prev_score_raw = assessment.get("previous_score", None)
            curr_score_raw = assessment.get("current_score", None)

            prev_num, prev_den, prev_perc = parse_score_string(prev_score_raw)
            curr_num, curr_den, curr_perc = parse_score_string(curr_score_raw)

            improvement_percentage = None
            comparison_status = "N/A" # improved, worsened, unchanged, new, changed

            if prev_perc is not None and curr_perc is not None:
                improvement_percentage = prev_perc - curr_perc
                if improvement_percentage > 0:
                    comparison_status = "improved"
                elif improvement_percentage < 0:
                    comparison_status = "worsened"
                else:
                    comparison_status = "unchanged"
            elif prev_score_raw and curr_score_raw:
                if prev_score_raw.lower() == "not documented" or prev_score_raw.lower() == "not tested":
                    comparison_status = "new"
                elif prev_score_raw == curr_score_raw:
                    comparison_status = "unchanged"
                else:
                    comparison_status = "changed" # For non-numeric changes
            else:
                 comparison_status = "not_performed" if (prev_score_raw is None or prev_score_raw.lower() == "not documented") and (curr_score_raw is None or curr_score_raw.lower() == "not documented") else "N/A" # Default for empty/missing
            
            processed_assessments.append({
                "name": assessment_name,
                "previous_score_raw": prev_score_raw,
                "current_score_raw": curr_score_raw,
                "previous_numerator": prev_num,
                "previous_denominator": prev_den,
                "previous_percentage": prev_perc,
                "current_numerator": curr_num,
                "current_denominator": curr_den,
                "current_percentage": curr_perc,
                "improvement_percentage": improvement_percentage,
                "comparison_status": comparison_status
            })
        data["sections"]["outcome_assessments_parsed"] = processed_assessments
        logger.info(f"Outcome assessments parsed count: {len(processed_assessments)}")
        logger.info(f"Outcome assessments parsed data: {json.dumps(processed_assessments, indent=2)}")
    else:
        data["sections"]["outcome_assessments_parsed"] = []
        logger.info("No outcome assessments data to process")


    # 3. ROM (Cervical & Lumbar): Ensure all 6 movements are present for table consistency
    # The AI should be providing array of objects. Python ensures completeness for templating.
    logger.info("\n--- Processing ROM Data ---")
    rom_sections_map = {
        "cervical_rom": [
            ("Flexion", "Flexion"), ("Extension", "Extension"),
            ("Left Rotation", "Left Rotation"), ("Right Rotation", "Right Rotation"),
            ("Left Lateral Flexion", "Left Lateral Flexion"), ("Right Lateral Flexion", "Right Lateral Flexion")
        ],
        "lumbar_rom": [
            ("Flexion", "Flexion"), ("Extension", "Extension"),
            ("Left Lateral Flexion", "Left Lateral Flexion"), ("Right Lateral Flexion", "Right Lateral Flexion"),
            ("Left Rotation", "Left Rotation"), ("Right Rotation", "Right Rotation")
        ]
    }

    for rom_key, standard_movements in rom_sections_map.items():
        logger.info(f"\nProcessing {rom_key}:")
        current_rom_data_raw = data.get("sections", {}).get(rom_key)
        logger.info(f"{rom_key} raw data: {json.dumps(current_rom_data_raw, indent=2) if current_rom_data_raw else 'None'}")
        
        current_rom_data_map = {}
        if current_rom_data_raw:
            current_rom_data_map = {item["movement"]: item for item in current_rom_data_raw}
        
        processed_rom = []
        for display_name, internal_name_for_ai_output in standard_movements:
            item = current_rom_data_map.get(internal_name_for_ai_output)
            prev_state = str(item.get("previous_state", "Not Documented")) if item else "Not Documented"
            curr_state = str(item.get("current_state", "Not Documented")) if item else "Not Documented"

            comparison_status = "N/A"
            if prev_state.lower() == "not documented" or prev_state.lower() == "not tested":
                comparison_status = "new" if curr_state.lower() != "not documented" else "not_performed"
            elif curr_state.lower() == "not documented" or curr_state.lower() == "not tested":
                comparison_status = "not_performed" # Current state is not documented, implies not tested this time.
            elif "normal" in curr_state.lower() and "normal" not in prev_state.lower():
                comparison_status = "improved"
            elif prev_state.lower() == curr_state.lower(): # Case-insensitive comparison
                comparison_status = "unchanged"
            elif ("restricted" in curr_state.lower() or "painful" in curr_state.lower()) and \
                 ("normal" in prev_state.lower() or "unrestricted" in prev_state.lower()):
                comparison_status = "worsened"
            else: # e.g., restricted to severely restricted, or other descriptive changes
                comparison_status = "changed"
            
            processed_rom.append({
                "movement": display_name, # Use display name for template
                "previous_state": prev_state,
                "current_state": curr_state,
                "comparison_status": comparison_status
            })
        # Check if all ROM entries are "Not Documented" for both previous and current
        all_not_documented = all(
            item["previous_state"].lower() in ["not documented", "not tested"] and 
            item["current_state"].lower() in ["not documented", "not tested"]
            for item in processed_rom
        )
        
        data["sections"][f"{rom_key}_parsed"] = processed_rom
        data["sections"][f"{rom_key}_all_not_documented"] = all_not_documented
        logger.info(f"{rom_key} parsed count: {len(processed_rom)}")
        logger.info(f"{rom_key} all entries not documented: {all_not_documented}")
        logger.info(f"{rom_key} parsed data: {json.dumps(processed_rom, indent=2)}")


    # 4. Motor Exam & Reflexes: Split combined strings into previous/current for right/left, and derive status
    # This assumes AI output for 'right' and 'left' is a string like "Previously X | currently Y" or just "Y".
    logger.info("\n--- Processing Motor Exam & Reflexes ---")
    exam_types = {
        "motor_exam": {
            "upper_extremity": ["DELTOID", "BICEPS", "TRICEPS", "WRIST EXT", "FINGER FLEX", "FINGER EXT", "THUMB EXT", "HAND INTRINSICS"],
            "lower_extremity": ["ILIOPSOAS", "QUAD", "HAMSTRINGS", "GLUTEUS", "ANTERIOR TIBIALIS", "EXT HALLUCIS LONGUS"]
        },
        "reflexes": {
            "deep_tendon": ["BICEPS", "TRICEPS", "BRACHIORADIALIS", "PATELLAR", "ACHILLES"],
            "pathological": ["HOFFMAN", "BABINSKI", "CLONUS (ANKLE)"]
        }
    }

    for exam_type, side_types_map in exam_types.items():
        logger.info(f"\nProcessing {exam_type}:")
        exam_data = data.get(exam_type)
        logger.info(f"{exam_type} raw data: {json.dumps(exam_data, indent=2) if exam_data else 'None'}")
        
        if exam_data is None: # If entire motor_exam or reflexes is null
            # Skip processing entirely if the exam type is null
            logger.info(f"Skipping {exam_type} - data is null")
            continue
        
        for side_type, standard_items in side_types_map.items():
            logger.info(f"\n  Processing {exam_type}.{side_type}:")
            current_exam_data_raw = data[exam_type].get(side_type)
            logger.info(f"  {side_type} raw data: {json.dumps(current_exam_data_raw, indent=2) if current_exam_data_raw else 'None'}")
            
            current_exam_data_map = {}
            # Use "muscle" or "reflex" as key depending on exam_type
            key_field = "muscle" if exam_type == "motor_exam" else "reflex"
            
            if current_exam_data_raw:
                current_exam_data_map = {item[key_field]: item for item in current_exam_data_raw}

            processed_items = []
            for item_name in standard_items:
                item = current_exam_data_map.get(item_name, {}) # Get existing item or empty dict

                new_item = {key_field: item_name} # Start with the item name
                
                for side in ["right", "left"]:
                    full_string = str(item.get(side, "Not Documented")) # Default to "Not Documented" if not present
                    prev_val = "Not Documented"
                    curr_val = "Not Documented" 
                    
                    if "not tested" in full_string.lower():
                        prev_val = "Not Tested"
                        curr_val = "Not Tested"
                    elif "Not Documented" in full_string and "currently" in full_string:
                        parts = full_string.split("currently", 1)
                        prev_val = parts[0].replace("Previously", "").strip()
                        curr_val = parts[1].strip()
                    elif "|" in full_string:
                        parts = full_string.split("|", 1)
                        prev_val = parts[0].replace("Previously", "").strip()
                        curr_val = parts[1].replace("currently", "").strip()
                    elif "Previously" in full_string and "currently" in full_string: # Fallback format
                        parts = full_string.split("currently", 1)
                        prev_val = parts[0].replace("Previously", "").replace(",", "").strip()
                        curr_val = parts[1].strip()
                    elif full_string and full_string.lower() != "not documented": 
                        # Only current value provided (implies unchanged or new current). AI rule: if unchanged, state only current
                        prev_val = full_string # Assume previous was same if no explicit comparison
                        curr_val = full_string
                    
                    new_item[f"{side}_previous"] = prev_val
                    new_item[f"{side}_current"] = curr_val
                    
                    # Determine comparison status for motor/reflex
                    status = "N/A"
                    if prev_val.lower() == "not documented" or prev_val.lower() == "not tested":
                        status = "new" if curr_val.lower() not in ["not documented", "not tested"] else "not_performed"
                    elif curr_val.lower() == "not documented" or curr_val.lower() == "not tested":
                        status = "not_performed" # Current state is not documented, implies not tested this time.
                    elif prev_val.lower() == curr_val.lower():
                        status = "unchanged"
                    else: # There's a change
                        if exam_type == "motor_exam":
                            try:
                                # Simple numeric comparison for motor strength X/5, handling X+/5
                                # Convert '4+/5' to '4.5' for comparison
                                def grade_to_float(grade_str):
                                    if grade_str and '/' in grade_str:
                                        num_str = grade_str.split('/')[0].strip()
                                        if num_str.endswith('+'):
                                            return float(num_str[:-1]) + 0.5
                                        elif num_str.endswith('-'): # Though AI says no minus
                                            return float(num_str[:-1]) - 0.5
                                        return float(num_str)
                                    return -1 # Invalid grade, for comparison purposes

                                prev_grade_num = grade_to_float(prev_val)
                                curr_grade_num = grade_to_float(curr_val)
                                
                                if curr_grade_num > prev_grade_num:
                                    status = "improved"
                                elif curr_grade_num < prev_grade_num:
                                    status = "worsened"
                                else:
                                    status = "changed" # Numerical value is same, but maybe 4/5 vs 4/5 for example
                            except (ValueError, IndexError):
                                status = "changed" # Cannot parse numerically
                        elif exam_type == "reflexes":
                            # DTR Grading: "0" (Absent), "1+" (Hypoactive), "2+" (NORMAL), "3+" (Hyperactive), "4+" (Clonus).
                            # Pathological: "positive" or "negative".
                            dtr_scale = {"0": 0, "1+": 1, "2+": 2, "3+": 3, "4+": 4}
                            prev_scaled = dtr_scale.get(prev_val, -1) # -1 for unrecognised/pathological
                            curr_scaled = dtr_scale.get(curr_val, -1)

                            if prev_scaled != -1 and curr_scaled != -1: # Both are DTRs
                                if curr_scaled < prev_scaled: # e.g., 3+ to 2+, 2+ to 1+
                                    status = "improved" if curr_scaled <= 2 else "changed" # If moves towards normal/hypo
                                elif curr_scaled > prev_scaled: # e.g., 2+ to 3+, 1+ to 2+
                                    status = "worsened" if curr_scaled > 2 else "improved" # If moves towards hyper
                                else:
                                    status = "unchanged"
                            elif "positive" in prev_val.lower() and "negative" in curr_val.lower():
                                status = "improved"
                            elif "negative" in prev_val.lower() and "positive" in curr_val.lower():
                                status = "worsened"
                            else:
                                status = "changed" # Any other difference
                    new_item[f"{side}_status"] = status
                processed_items.append(new_item)
            # Check if all items are "Not Documented" for both sides
            all_not_documented = all(
                item.get(f"{side}_previous", "").lower() in ["not documented", "not tested"] and 
                item.get(f"{side}_current", "").lower() in ["not documented", "not tested"]
                for item in processed_items
                for side in ["right", "left"]
            )
            
            data[exam_type][f"{side_type}_parsed"] = processed_items
            data[exam_type][f"{side_type}_all_not_documented"] = all_not_documented
            logger.info(f"  {side_type} parsed count: {len(processed_items)}")
            logger.info(f"  {side_type} all entries not documented: {all_not_documented}")
            logger.info(f"  {side_type} parsed data: {json.dumps(processed_items, indent=2)}")
    
    # 5. Orthopedic/Special Tests (`cervico_thoracic`, `lumbopelvic`, `extremity`):
    # Already an array of objects per schema. Derive comparison_status.
    logger.info("\n--- Processing Orthopedic/Special Tests ---")
    ortho_sections = ["cervico_thoracic", "lumbopelvic", "extremity"]
    for section_key in ortho_sections:
        logger.info(f"\nProcessing {section_key}:")
        current_tests_raw = data.get("sections", {}).get(section_key)
        logger.info(f"{section_key} raw data: {json.dumps(current_tests_raw, indent=2) if current_tests_raw else 'None'}")
        
        if current_tests_raw:
            processed_tests = []
            for test in current_tests_raw:
                test_name = test.get("test_name", "Unknown Test")
                prev_result = str(test.get("previous_result", "Not Documented"))
                current_result = str(test.get("current_result", "Not Documented"))

                comparison_status = "N/A" # improved, worsened, unchanged, new, changed, not_performed
                
                if prev_result.lower() == "not documented" or prev_result.lower() == "not tested":
                    comparison_status = "new" if current_result.lower() not in ["not documented", "not tested"] else "not_performed"
                elif current_result.lower() == "not documented" or current_result.lower() == "not tested":
                    comparison_status = "not_performed"
                elif "negative" in current_result.lower() and "positive" in prev_result.lower():
                    comparison_status = "improved"
                elif "positive" in current_result.lower() and "negative" in prev_result.lower():
                    comparison_status = "worsened"
                elif prev_result.lower() == current_result.lower():
                    comparison_status = "unchanged"
                else: # Any other difference, e.g., "mild positive" vs "marked positive"
                    comparison_status = "changed"
                
                processed_tests.append({
                    "test_name": test_name,
                    "previous_result": prev_result,
                    "current_result": current_result,
                    "comparison_status": comparison_status
                })
            # Check if all orthopedic test entries are "Not Documented" for both previous and current
            all_not_documented = all(
                test["previous_result"].lower() in ["not documented", "not tested"] and 
                test["current_result"].lower() in ["not documented", "not tested"]
                for test in processed_tests
            )
            
            data["sections"][f"{section_key}_parsed"] = processed_tests
            data["sections"][f"{section_key}_all_not_documented"] = all_not_documented
            logger.info(f"{section_key} parsed count: {len(processed_tests)}")
            logger.info(f"{section_key} all entries not documented: {all_not_documented}")
            logger.info(f"{section_key} parsed data: {json.dumps(processed_tests, indent=2)}")
        else:
            data["sections"][f"{section_key}_parsed"] = [] # Ensure empty array if section is null
            data["sections"][f"{section_key}_all_not_documented"] = True  # Consider empty as all not documented
            logger.info(f"No {section_key} data to process")

    # 6. Cranial Nerve Examination: Already an array of objects per schema. Derive comparison_status.
    # Ensure all 12 CNs are present for table consistency.
    logger.info("\n--- Processing Cranial Nerve Examination ---")
    cranial_nerves_list = [
        "CN I: Olfactory", "CN II: Optic", "CN III: Oculomotor", "CN IV: Trochlear",
        "CN V: Trigeminal", "CN VI: Abducens", "CN VII: Facial", "CN VIII: Vestibulocochlear",
        "CN IX: Glossopharyngeal", "CN X: Vagus", "CN XI: Accessory", "CN XII: Hypoglossal"
    ]
    
    current_cns_raw = data.get("cranial_nerve_examination")
    logger.info(f"Cranial nerve raw data: {json.dumps(current_cns_raw, indent=2) if current_cns_raw else 'None'}")
    
    current_cns_map = {}
    if current_cns_raw:
        # Handle both "nerve" and "cranial_nerve" field names for backward compatibility
        key_field = "nerve" if current_cns_raw and "nerve" in current_cns_raw[0] else "cranial_nerve"
        current_cns_map = {item.get(key_field, item.get("cranial_nerve", item.get("nerve", ""))): item for item in current_cns_raw}

    processed_cns = []
    for cn_name in cranial_nerves_list:
        cn_item = current_cns_map.get(cn_name, {}) # Get existing item or empty dict

        prev_finding = str(cn_item.get("previous_finding", "Not Documented"))
        current_finding = str(cn_item.get("current_finding", "Not Documented"))

        comparison_status = "N/A" # improved, worsened, unchanged, new, changed, not_performed

        if prev_finding.lower() == "not documented" or prev_finding.lower() == "not tested":
            comparison_status = "new" if current_finding.lower() not in ["not documented", "not tested"] else "not_performed"
        elif current_finding.lower() == "not documented" or current_finding.lower() == "not tested":
            comparison_status = "not_performed"
        elif prev_finding.lower() == current_finding.lower():
            comparison_status = "unchanged"
        else: # Semantic comparison for intact/weakness/diminished
            # Simplified heuristic for improvement/worsening
            # Assume 'intact' is best, 'weakness'/'diminished' are worse, 'absent' is worst.
            finding_hierarchy = ["absent", "weakness noted", "diminished", "intact"]
            
            prev_level = finding_hierarchy.index(prev_finding.lower()) if prev_finding.lower() in finding_hierarchy else -1
            curr_level = finding_hierarchy.index(current_finding.lower()) if current_finding.lower() in finding_hierarchy else -1

            if curr_level > prev_level:
                comparison_status = "improved"
            elif curr_level < prev_level:
                comparison_status = "worsened"
            else:
                comparison_status = "changed" # Any other significant difference
        
        processed_cns.append({
            "cranial_nerve": cn_name,
            "previous_finding": prev_finding,
            "current_finding": current_finding,
            "comparison_status": comparison_status
        })
    # Check if all cranial nerve entries are "Not Documented" for both previous and current
    all_not_documented = all(
        cn["previous_finding"].lower() in ["not documented", "not tested"] and 
        cn["current_finding"].lower() in ["not documented", "not tested"]
        for cn in processed_cns
    )
    
    data["cranial_nerve_examination_parsed"] = processed_cns
    data["cranial_nerve_examination_all_not_documented"] = all_not_documented
    logger.info(f"Cranial nerve parsed count: {len(processed_cns)}")
    logger.info(f"Cranial nerve all entries not documented: {all_not_documented}")
    logger.info(f"Cranial nerve parsed data: {json.dumps(processed_cns, indent=2)}")
    
    # Log final processed data structure
    logger.info("\n=== TEMPLATE PREPROCESSOR COMPLETE ===")
    logger.info(f"Final data structure keys: {list(data.keys())}")
    logger.info(f"Final sections keys: {list(data.get('sections', {}).keys())}")
    logger.info(f"Full processed data: {json.dumps(data, indent=2)}")
    
    return data


def prepare_initial_exam_data_for_template(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Preprocesses initial examination data to ensure consistency and completeness,
    particularly for cranial nerve examination.
    """
    logger.info("\n=== INITIAL EXAM TEMPLATE PREPROCESSOR ===")
    logger.info(f"Processing initial examination data")
    
    # Ensure all 12 cranial nerves are present
    cranial_nerves_list = [
        "CN I: Olfactory", "CN II: Optic", "CN III: Oculomotor", "CN IV: Trochlear",
        "CN V: Trigeminal", "CN VI: Abducens", "CN VII: Facial", "CN VIII: Vestibulocochlear",
        "CN IX: Glossopharyngeal", "CN X: Vagus", "CN XI: Accessory", "CN XII: Hypoglossal"
    ]
    
    # Get existing cranial nerve data
    existing_cns = data.get("cranial_nerve_examination", [])
    logger.info(f"Existing cranial nerve data: {json.dumps(existing_cns, indent=2) if existing_cns else 'None'}")
    logger.info(f"Type of existing_cns: {type(existing_cns)}")
    
    # If we have existing cranial nerve data, just return it as-is
    # Do NOT try to "complete" it with "Not tested" values
    if existing_cns and isinstance(existing_cns, list) and len(existing_cns) > 0:
        logger.info(f"Found {len(existing_cns)} cranial nerves in data, using as-is without modification")
        # Just ensure the data structure is correct and normalize field names
        valid_cns = []
        for item in existing_cns:
            if isinstance(item, dict):
                # Handle both "nerve" and "cranial_nerve" field names due to Pydantic aliasing
                nerve_name = item.get("nerve") or item.get("cranial_nerve")
                finding = item.get("finding")
                
                if nerve_name and finding:
                    # Always use "nerve" as the field name for template compatibility
                    valid_cns.append({
                        "nerve": nerve_name,
                        "finding": finding
                    })
                    logger.info(f"Added cranial nerve: {nerve_name} -> {finding}")
        
        if valid_cns:
            data["cranial_nerve_examination"] = valid_cns
            logger.info(f"Using {len(valid_cns)} valid cranial nerve entries")
            
            # Check if all cranial nerve entries are "Not tested"
            all_not_tested = all(
                cn["finding"].lower() in ["not tested", "not documented", "not performed"]
                for cn in valid_cns
            )
            data["cranial_nerve_examination_all_not_tested"] = all_not_tested
            logger.info(f"All cranial nerves not tested: {all_not_tested}")
            
            return data
    
    # Only if we have NO cranial nerve data at all, create the default structure
    logger.info("No cranial nerve data found, creating default structure")
    complete_cns = []
    for cn_name in cranial_nerves_list:
        complete_cns.append({
            "nerve": cn_name,
            "finding": "Not tested"
        })
    
    data["cranial_nerve_examination"] = complete_cns
    # When we create default structure, all are "Not tested"
    data["cranial_nerve_examination_all_not_tested"] = True
    logger.info(f"Created default cranial nerve structure with all 12 nerves as 'Not tested'")
    
    return data