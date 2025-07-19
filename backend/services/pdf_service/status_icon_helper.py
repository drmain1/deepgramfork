"""
Helper module for rendering status icons in PDFs with better cross-platform compatibility.
Uses ASCII characters and text-based indicators instead of Unicode symbols.
"""

def get_status_icon_html(status: str) -> str:
    """
    Returns HTML for a status icon that renders reliably across different environments.
    Uses ASCII characters and styled text instead of Unicode symbols.
    """
    icon_map = {
        "improved": '<span class="status-icon status-improved">[IMPROVED]</span>',
        "resolved": '<span class="status-icon status-resolved">[RESOLVED]</span>',
        "worsened": '<span class="status-icon status-worsened">[WORSE]</span>',
        "unchanged": '<span class="status-icon status-unchanged">[SAME]</span>',
        "new": '<span class="status-icon status-new">[NEW]</span>',
        "changed": '<span class="status-icon status-changed">[CHANGED]</span>',
        "not_performed": '<span class="status-icon status-not-performed">[N/A]</span>',
    }
    
    # Return the icon HTML or a default for unknown statuses
    return icon_map.get(status, '<span class="status-icon status-unknown">[?]</span>')


def get_status_icon_text(status: str) -> str:
    """
    Returns text representation of status for better compatibility.
    """
    text_map = {
        "improved": "[+]",
        "resolved": "[OK]",
        "worsened": "[-]",
        "unchanged": "[=]",
        "new": "[*]",
        "changed": "[~]",
        "not_performed": "[NA]",
    }
    
    return text_map.get(status, "[?]")