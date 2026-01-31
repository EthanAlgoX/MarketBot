#!/usr/bin/env python3
"""
🛡️ Clawdbot Skill Flag
Scan installed skills for malicious patterns, backdoors, and security risks.

Author: DarkM00n (Bug Bounty Hunter & Security Researcher)
"""

import os
import re
import sys
import yaml
import json
import argparse
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

# Colors for terminal output
class Colors:
    RED = '\033[91m'
    ORANGE = '\033[93m'
    YELLOW = '\033[33m'
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

@dataclass
class Finding:
    pattern_name: str
    description: str
    risk: int
    file: str
    line_number: int
    line_content: str
    category: str

@dataclass
class SkillReport:
    name: str
    path: str
    files_scanned: int = 0
    findings: list = field(default_factory=list)
    risk_score: int = 0
    
    def calculate_risk(self):
        if not self.findings:
            self.risk_score = 0
            return
        # Weighted average with max cap
        total_risk = sum(f.risk for f in self.findings)
        self.risk_score = min(100, total_risk // max(1, len(self.findings)) + len(self.findings) * 5)
    
    def risk_level(self):
        if self.risk_score <= 20:
            return "✅ CLEAN", Colors.GREEN
        elif self.risk_score <= 40:
            return "🟢 LOW", Colors.GREEN
        elif self.risk_score <= 60:
            return "🟡 MEDIUM", Colors.YELLOW
        elif self.risk_score <= 80:
            return "🟠 HIGH", Colors.ORANGE
        else:
            return "🔴 CRITICAL", Colors.RED


class SecurityScanner:
    def __init__(self, verbose=False):
        self.verbose = verbose
        self.patterns = {}
        self.whitelist = set()
        self.load_patterns()
        
    def load_patterns(self):
        """Load all pattern files from patterns/ directory"""
        patterns_dir = Path(__file__).parent / "patterns"
        
        for yaml_file in patterns_dir.glob("*.yaml"):
            try:
                with open(yaml_file) as f:
                    data = yaml.safe_load(f)
                    category = yaml_file.stem
                    
                    if data and 'patterns' in data:
                        for pattern in data['patterns']:
                            pattern['category'] = category
                            pattern['compiled'] = re.compile(pattern['regex'], re.IGNORECASE | re.MULTILINE)
                        self.patterns[category] = data['patterns']
                    
                    if data and 'whitelist' in data:
                        self.whitelist.update(data['whitelist'])
                        
            except Exception as e:
                print(f"{Colors.ORANGE}Warning: Could not load {yaml_file}: {e}{Colors.END}")
    
    def get_skill_directories(self):
        """Return list of directories to scan for skills"""
        home = Path.home()
        dirs = [
            home / ".clawdbot" / "skills",
            Path.cwd() / "skills",
            home / ".npm-global" / "lib" / "node_modules" / "clawdbot" / "skills",
        ]
        return [d for d in dirs if d.exists()]
    
    def find_skills(self, specific_skill=None):
        """Find all skills or a specific skill"""
        skills = []
        
        for skill_dir in self.get_skill_directories():
            if specific_skill:
                skill_path = skill_dir / specific_skill
                if skill_path.exists() and skill_path.is_dir():
                    skills.append(skill_path)
            else:
                for item in skill_dir.iterdir():
                    if item.is_dir() and (item / "SKILL.md").exists():
                        skills.append(item)
        
        return skills
    
    def scan_file(self, file_path: Path, skill_name: str) -> list:
        """Scan a single file for malicious patterns"""
        findings = []
        
        try:
            content = file_path.read_text(errors='ignore')
            lines = content.split('\n')
            
            # Check each pattern category
            for category, patterns in self.patterns.items():
                for pattern in patterns:
                    for match in pattern['compiled'].finditer(content):
                        # Find line number
                        line_start = content.count('\n', 0, match.start()) + 1
                        line_content = lines[line_start - 1] if line_start <= len(lines) else ""
                        
                        # Check whitelist
                        whitelisted = any(wl in match.group() for wl in self.whitelist)
                        if whitelisted:
                            if self.verbose:
                                print(f"  {Colors.BLUE}[whitelist] {pattern['name']} - {file_path.name}:{line_start}{Colors.END}")
                            continue
                        
                        findings.append(Finding(
                            pattern_name=pattern['name'],
                            description=pattern['description'],
                            risk=pattern['risk'],
                            file=str(file_path.relative_to(file_path.parent.parent)),
                            line_number=line_start,
                            line_content=line_content.strip()[:100],
                            category=category
                        ))
                        
        except Exception as e:
            if self.verbose:
                print(f"  {Colors.ORANGE}Error reading {file_path}: {e}{Colors.END}")
        
        return findings
    
    def scan_skill(self, skill_path: Path) -> SkillReport:
        """Scan an entire skill directory"""
        report = SkillReport(
            name=skill_path.name,
            path=str(skill_path)
        )
        
        # File extensions to scan
        scan_extensions = {'.py', '.sh', '.bash', '.js', '.ts', '.md', '.yaml', '.yml', '.json'}
        
        for file_path in skill_path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in scan_extensions:
                report.files_scanned += 1
                findings = self.scan_file(file_path, skill_path.name)
                report.findings.extend(findings)
        
        report.calculate_risk()
        return report
    
    def scan_all(self, specific_skill=None) -> list:
        """Scan all skills and return reports"""
        skills = self.find_skills(specific_skill)
        reports = []
        
        for skill_path in skills:
            if self.verbose:
                print(f"\n{Colors.CYAN}Scanning: {skill_path.name}{Colors.END}")
            report = self.scan_skill(skill_path)
            reports.append(report)
            
        return reports
    
    def print_report(self, reports: list):
        """Print formatted scan report"""
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}🛡️  CLAWDBOT SECURITY SCAN REPORT{Colors.END}")
        print(f"{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 Skills scanned: {len(reports)}")
        
        # Summary
        clean = sum(1 for r in reports if r.risk_score <= 20)
        low = sum(1 for r in reports if 20 < r.risk_score <= 40)
        medium = sum(1 for r in reports if 40 < r.risk_score <= 60)
        high = sum(1 for r in reports if 60 < r.risk_score <= 80)
        critical = sum(1 for r in reports if r.risk_score > 80)
        
        print(f"\n{Colors.BOLD}📊 SUMMARY{Colors.END}")
        print(f"  ✅ Clean:    {clean}")
        print(f"  🟢 Low:      {low}")
        print(f"  🟡 Medium:   {medium}")
        print(f"  🟠 High:     {high}")
        print(f"  🔴 Critical: {critical}")
        
        # Sort by risk score
        reports.sort(key=lambda r: r.risk_score, reverse=True)
        
        # Details
        print(f"\n{Colors.BOLD}📋 DETAILS{Colors.END}")
        print("-" * 60)
        
        for report in reports:
            level, color = report.risk_level()
            print(f"\n{color}{Colors.BOLD}{report.name}{Colors.END}")
            print(f"  Risk: {color}{level}{Colors.END} (score: {report.risk_score})")
            print(f"  Files: {report.files_scanned}")
            print(f"  Path: {report.path}")
            
            if report.findings:
                print(f"  {Colors.BOLD}Findings ({len(report.findings)}):{Colors.END}")
                for f in report.findings[:10]:  # Limit to first 10
                    risk_color = Colors.RED if f.risk >= 80 else Colors.ORANGE if f.risk >= 60 else Colors.YELLOW
                    print(f"    {risk_color}• [{f.category}] {f.pattern_name}{Colors.END}")
                    print(f"      {f.description}")
                    print(f"      📄 {f.file}:{f.line_number}")
                    if f.line_content:
                        print(f"      └─ {Colors.CYAN}{f.line_content[:80]}...{Colors.END}" if len(f.line_content) > 80 else f"      └─ {Colors.CYAN}{f.line_content}{Colors.END}")
                
                if len(report.findings) > 10:
                    print(f"    ... and {len(report.findings) - 10} more findings")
        
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        
        # Recommendations
        if critical > 0:
            print(f"\n{Colors.RED}{Colors.BOLD}⚠️  ACTION REQUIRED:{Colors.END}")
            print(f"{Colors.RED}   {critical} skill(s) have CRITICAL security issues.{Colors.END}")
            print(f"{Colors.RED}   Review immediately and consider removing them.{Colors.END}")
        elif high > 0:
            print(f"\n{Colors.ORANGE}{Colors.BOLD}⚠️  REVIEW RECOMMENDED:{Colors.END}")
            print(f"{Colors.ORANGE}   {high} skill(s) have HIGH risk findings.{Colors.END}")
            print(f"{Colors.ORANGE}   Manual review recommended before continued use.{Colors.END}")
        else:
            print(f"\n{Colors.GREEN}✅ All skills appear safe. Regular scans recommended.{Colors.END}")
    
    def export_json(self, reports: list, output_file: str):
        """Export report as JSON"""
        data = {
            "scan_date": datetime.now().isoformat(),
            "skills_scanned": len(reports),
            "reports": []
        }
        
        for report in reports:
            data["reports"].append({
                "name": report.name,
                "path": report.path,
                "files_scanned": report.files_scanned,
                "risk_score": report.risk_score,
                "risk_level": report.risk_level()[0],
                "findings": [
                    {
                        "pattern": f.pattern_name,
                        "description": f.description,
                        "risk": f.risk,
                        "category": f.category,
                        "file": f.file,
                        "line": f.line_number,
                        "content": f.line_content
                    }
                    for f in report.findings
                ]
            })
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n📄 Report exported to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="🛡️ Clawdbot Skill Flag - Scan skills for security issues"
    )
    parser.add_argument('--skill', '-s', help='Scan specific skill by name')
    parser.add_argument('--all', '-a', action='store_true', help='Scan all installed skills')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--json', '-j', help='Export report as JSON to specified file')
    parser.add_argument('--quiet', '-q', action='store_true', help='Only show critical findings')
    
    args = parser.parse_args()
    
    scanner = SecurityScanner(verbose=args.verbose)
    
    if args.skill:
        print(f"🔍 Scanning skill: {args.skill}")
        reports = scanner.scan_all(specific_skill=args.skill)
    else:
        print("🔍 Scanning all installed skills...")
        reports = scanner.scan_all()
    
    if not reports:
        print(f"\n{Colors.YELLOW}No skills found to scan.{Colors.END}")
        print("Checked directories:")
        for d in scanner.get_skill_directories():
            print(f"  - {d}")
        return
    
    scanner.print_report(reports)
    
    if args.json:
        scanner.export_json(reports, args.json)


if __name__ == "__main__":
    main()
