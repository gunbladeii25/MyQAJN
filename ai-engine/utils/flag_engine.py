"""Risk flag generation logic for Agent B."""
from datetime import date, datetime


def generate_flags(
    di_value: float,
    category: str,
    severity: str,
    school_data: dict,
    repeat_count: int = 0,
) -> list[str]:
    flags = []

    risk_index = float(school_data.get("integrity_risk_index", 0))
    hygiene = school_data.get("canteen_hygiene_score")
    last_audit = school_data.get("last_audit_date")
    emis_suspended = school_data.get("emis_access_suspended", False)
    school_code_match = school_data.get("school_code_match", True)
    has_audit_record = school_data.get("has_audit_record", True)

    if risk_index > 0.60:
        flags.append("HIGH_INTEGRITY_RISK_SCHOOL")

    if hygiene is not None and float(hygiene) < 50:
        flags.append("CANTEEN_HYGIENE_BELOW_THRESHOLD")

    if last_audit:
        if isinstance(last_audit, str):
            try:
                last_audit = datetime.fromisoformat(last_audit).date()
            except Exception:
                last_audit = None
        if last_audit and isinstance(last_audit, (date, datetime)):
            if hasattr(last_audit, 'date'):
                last_audit = last_audit.date()
            days_stale = (date.today() - last_audit).days
            if days_stale > 1095:
                flags.append(f"AUDIT_DATA_STALE_{days_stale}_DAYS")

    if not school_code_match:
        flags.append("SCHOOL_CODE_MISMATCH")

    if di_value >= 0.50 and category == "Administrative_Misconduct":
        flags.append("POTENTIAL_DATA_MANIPULATION")

    if severity == "CRITICAL":
        flags.append("CRITICAL_SEVERITY_INCIDENT")

    if emis_suspended:
        flags.append("EMIS_ACCESS_PREVIOUSLY_SUSPENDED")

    if not has_audit_record:
        flags.append("NO_AUDIT_RECORD_FOUND")

    if repeat_count >= 3:
        flags.append("REPEATED_DISCREPANCY")

    return flags
