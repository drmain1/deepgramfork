#!/usr/bin/env python3
"""
Monitor for Firebase token clock skew issues in logs.
This script can be run periodically to check for clock skew problems.
"""

import re
import json
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Tuple

def parse_log_file(log_file_path: str, hours_back: int = 24) -> Tuple[List[Dict], Dict[str, int]]:
    """
    Parse log file for clock skew events within the specified time window.
    
    Returns:
        - List of clock skew events
        - Dictionary of error counts by type
    """
    clock_skew_events = []
    error_counts = defaultdict(int)
    
    # Regex patterns for clock skew detection
    clock_skew_pattern = re.compile(r'Clock skew detected: (\d+) seconds')
    token_early_pattern = re.compile(r'Token used too early, (\d+) < (\d+)')
    
    cutoff_time = datetime.now() - timedelta(hours=hours_back)
    
    try:
        with open(log_file_path, 'r') as f:
            for line in f:
                # Check for clock skew warnings
                if 'Clock skew detected' in line:
                    match = clock_skew_pattern.search(line)
                    if match:
                        skew_seconds = int(match.group(1))
                        clock_skew_events.append({
                            'type': 'clock_skew',
                            'seconds': skew_seconds,
                            'timestamp': datetime.now().isoformat(),
                            'log_line': line.strip()
                        })
                        error_counts['clock_skew'] += 1
                
                # Check for token early errors
                elif 'Token used too early' in line:
                    match = token_early_pattern.search(line)
                    if match:
                        server_time = int(match.group(1))
                        token_time = int(match.group(2))
                        clock_skew_events.append({
                            'type': 'token_early',
                            'server_time': server_time,
                            'token_time': token_time,
                            'diff_seconds': token_time - server_time,
                            'timestamp': datetime.now().isoformat(),
                            'log_line': line.strip()
                        })
                        error_counts['token_early'] += 1
                
                # Check for exhausted retries
                elif 'All retry attempts exhausted for clock skew error' in line:
                    error_counts['exhausted_retries'] += 1
                    
    except FileNotFoundError:
        print(f"Log file not found: {log_file_path}")
        return [], {}
    
    return clock_skew_events, dict(error_counts)

def generate_alert_report(events: List[Dict], error_counts: Dict[str, int]) -> Dict:
    """
    Generate an alert report based on clock skew events.
    """
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_events': len(events),
        'error_counts': error_counts,
        'alerts': [],
        'recommendations': []
    }
    
    # Calculate average skew
    if events:
        skew_values = [e.get('seconds', e.get('diff_seconds', 0)) for e in events]
        avg_skew = sum(skew_values) / len(skew_values)
        max_skew = max(skew_values)
        
        report['stats'] = {
            'average_skew_seconds': round(avg_skew, 2),
            'max_skew_seconds': max_skew
        }
        
        # Generate alerts based on thresholds
        if len(events) > 10:
            report['alerts'].append({
                'severity': 'HIGH',
                'message': f'High frequency of clock skew events: {len(events)} in the monitoring period'
            })
        
        if max_skew > 60:
            report['alerts'].append({
                'severity': 'MEDIUM',
                'message': f'Large clock skew detected: {max_skew} seconds'
            })
        
        if error_counts.get('exhausted_retries', 0) > 0:
            report['alerts'].append({
                'severity': 'HIGH',
                'message': f'Failed authentications due to clock skew: {error_counts["exhausted_retries"]}'
            })
    
    # Add recommendations
    if report['alerts']:
        report['recommendations'].extend([
            'Check NTP synchronization on all servers',
            'Consider increasing FIREBASE_CLOCK_SKEW_SECONDS if skew is consistent',
            'Verify that all servers are in the same timezone configuration',
            'Check for any recent server deployments or restarts that might affect time sync'
        ])
    
    return report

def main():
    """
    Main monitoring function.
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='Monitor Firebase token clock skew issues')
    parser.add_argument('--log-file', default='/var/log/app.log', help='Path to log file')
    parser.add_argument('--hours', type=int, default=24, help='Hours to look back')
    parser.add_argument('--output', choices=['json', 'text'], default='text', help='Output format')
    
    args = parser.parse_args()
    
    # Parse logs
    events, error_counts = parse_log_file(args.log_file, args.hours)
    
    # Generate report
    report = generate_alert_report(events, error_counts)
    
    # Output report
    if args.output == 'json':
        print(json.dumps(report, indent=2))
    else:
        print(f"\n=== Clock Skew Monitoring Report ===")
        print(f"Time: {report['timestamp']}")
        print(f"Total Events: {report['total_events']}")
        
        if report.get('stats'):
            print(f"\nStatistics:")
            print(f"  Average Skew: {report['stats']['average_skew_seconds']} seconds")
            print(f"  Max Skew: {report['stats']['max_skew_seconds']} seconds")
        
        if report['error_counts']:
            print(f"\nError Counts:")
            for error_type, count in report['error_counts'].items():
                print(f"  {error_type}: {count}")
        
        if report['alerts']:
            print(f"\nAlerts:")
            for alert in report['alerts']:
                print(f"  [{alert['severity']}] {alert['message']}")
        
        if report['recommendations']:
            print(f"\nRecommendations:")
            for rec in report['recommendations']:
                print(f"  - {rec}")
    
    # Exit with error code if alerts exist
    return 1 if report['alerts'] else 0

if __name__ == '__main__':
    exit(main())