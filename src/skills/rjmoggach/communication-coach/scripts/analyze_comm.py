#!/usr/bin/env python3
"""
Communication analysis tool for scoring text across behavioral dimensions.
Returns JSON with scores 0-10 for: clarity, vocal_control, presence, persuasion, boundary_setting
"""

import sys
import json
import re
import argparse
from collections import Counter

def count_words(text):
    """Count total words in text."""
    return len(text.split())

def average_sentence_length(text):
    """Calculate average sentence length in words."""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return 0
    words_per_sentence = [len(s.split()) for s in sentences]
    return sum(words_per_sentence) / len(words_per_sentence)

def count_filler_words(text):
    """Count filler words and hedging language."""
    fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'literally', 
               'just', 'really', 'very', 'kind of', 'sort of', 'maybe', 'probably',
               'I think', 'I guess', 'perhaps', 'possibly']
    
    text_lower = text.lower()
    count = 0
    for filler in fillers:
        count += text_lower.count(filler)
    return count

def detect_weak_language(text):
    """Detect presence-weakening language patterns."""
    weak_patterns = [
        r'\?',  # Questions in assertions
        r'\bhope\b', r'\btry\b', r'\bmight\b', r'\bmaybe\b',
        r'\bsorry\b', r'\bjust\b', r'\bkind of\b',
        r'\bI think\b', r'\bprobably\b'
    ]
    
    count = 0
    for pattern in weak_patterns:
        count += len(re.findall(pattern, text, re.IGNORECASE))
    return count

def detect_strong_markers(text):
    """Detect confidence and structure markers."""
    strong_patterns = [
        r'\bI (will|have decided|decided|am|built|launched)\b',
        r'\b(First|Second|Third|Therefore|In summary|Specifically)\b',
        r'\b(must|need to|require)\b'
    ]
    
    count = 0
    for pattern in strong_patterns:
        count += len(re.findall(pattern, text, re.IGNORECASE))
    return count

def detect_passive_voice(text):
    """Rough passive voice detection."""
    # Simple heuristic: "be" verb + past participle patterns
    passive_indicators = re.findall(r'\b(is|are|was|were|be|been|being) \w+ed\b', text, re.IGNORECASE)
    return len(passive_indicators)

def detect_rhetoric_elements(text):
    """Detect ethos, pathos, logos markers for persuasion scoring."""
    ethos_patterns = [
        r'\b(I\'ve|I have) (built|launched|led|managed|delivered)\b',
        r'\b(experience|track record|expertise)\b',
        r'\b(research|study|data) shows\b'
    ]
    
    pathos_patterns = [
        r'\b(imagine|picture|consider)\b',
        r'\b(risk|opportunity|critical|urgent)\b',
        r'\bif we (don\'t|fail to)\b',
        r'\b(story|example|case)\b'
    ]
    
    logos_patterns = [
        r'\b(because|therefore|thus|since)\b',
        r'\b(\d+%|\d+ percent)\b',
        r'\b(data|evidence|proof|shows|demonstrates)\b',
        r'\b(First|Second|Third)\b'
    ]
    
    ethos = sum(len(re.findall(p, text, re.IGNORECASE)) for p in ethos_patterns)
    pathos = sum(len(re.findall(p, text, re.IGNORECASE)) for p in pathos_patterns)
    logos = sum(len(re.findall(p, text, re.IGNORECASE)) for p in logos_patterns)
    
    return ethos, pathos, logos

def detect_boundary_setting(text):
    """Score boundary setting effectiveness."""
    # Direct "no" patterns
    direct_no = len(re.findall(r'\b(No|I\'m not available|I can\'t|I won\'t)\b', text, re.IGNORECASE))
    
    # Apologies for boundaries
    apologies = len(re.findall(r'\b(sorry|apologize|apologies)\b', text, re.IGNORECASE))
    
    # Over-justification (multiple "because" or explanation markers)
    justifications = len(re.findall(r'\b(because|since|as|due to)\b', text, re.IGNORECASE))
    
    return direct_no, apologies, justifications

def score_clarity(text):
    """Score clarity 0-10."""
    score = 10
    
    avg_sentence_len = average_sentence_length(text)
    if avg_sentence_len > 25:
        score -= 2
    elif avg_sentence_len > 20:
        score -= 1
    
    # Check for passive voice
    passive_count = detect_passive_voice(text)
    total_sentences = len(re.split(r'[.!?]+', text))
    if total_sentences > 0 and (passive_count / total_sentences) > 0.3:
        score -= 2
    
    # Check for structure markers
    if not re.search(r'\b(First|Second|Therefore|In summary|Specifically)\b', text, re.IGNORECASE):
        score -= 1
    
    # Penalize very long sentences
    sentences = re.split(r'[.!?]+', text)
    long_sentences = [s for s in sentences if len(s.split()) > 30]
    score -= len(long_sentences)
    
    return max(0, min(10, score))

def score_vocal_control(text):
    """Score vocal control (text proxy) 0-10."""
    score = 10
    
    filler_count = count_filler_words(text)
    score -= min(filler_count, 10)  # -1 per filler, max -10
    
    return max(0, min(10, score))

def score_presence(text):
    """Score presence 0-10."""
    score = 10
    
    weak_count = detect_weak_language(text)
    score -= min(weak_count * 2, 8)  # -2 per weak pattern
    
    strong_count = detect_strong_markers(text)
    score += min(strong_count, 3)  # +1 per strong marker, max +3
    
    return max(0, min(10, score))

def score_persuasion(text):
    """Score persuasion 0-10."""
    ethos, pathos, logos = detect_rhetoric_elements(text)
    
    score = 0
    score += min(ethos, 3)   # Max 3 points for ethos
    score += min(pathos, 3)  # Max 3 points for pathos
    score += min(logos, 3)   # Max 3 points for logos
    
    # Bonus for clear CTA
    if re.search(r'\b(Please|I need|Approve|Let\'s|We should)\b', text, re.IGNORECASE):
        score += 1
    
    return max(0, min(10, score))

def score_boundary_setting(text):
    """Score boundary setting 0-10."""
    direct_no, apologies, justifications = detect_boundary_setting(text)
    
    score = 0
    
    if direct_no > 0:
        score += 5
    
    if apologies > 0:
        score -= 5
    
    # Penalize over-justification (ratio of justifications to direct statements)
    word_count = count_words(text)
    if word_count > 0 and justifications > 2:
        score -= 2
    
    # Bonus for offering alternatives
    if re.search(r'\b(instead|alternatively|I can|available)\b', text, re.IGNORECASE):
        score += 2
    
    return max(0, min(10, score))

def analyze(text, modality="email-formal"):
    """
    Analyze text and return dimensional scores.
    
    Args:
        text: String to analyze
        modality: Communication context (email-formal, slack, sms, etc.)
    
    Returns:
        Dict with scores for each dimension
    """
    
    results = {
        "text_length": count_words(text),
        "modality": modality,
        "scores": {
            "clarity": score_clarity(text),
            "vocal_control": score_vocal_control(text),
            "presence": score_presence(text),
            "persuasion": score_persuasion(text),
            "boundary_setting": score_boundary_setting(text)
        },
        "diagnostics": {
            "avg_sentence_length": round(average_sentence_length(text), 1),
            "filler_count": count_filler_words(text),
            "weak_language_count": detect_weak_language(text),
            "strong_markers": detect_strong_markers(text),
            "passive_voice": detect_passive_voice(text)
        }
    }
    
    return results

def main():
    parser = argparse.ArgumentParser(description='Analyze communication text for behavioral dimensions')
    parser.add_argument('--text', type=str, required=True, help='Text to analyze')
    parser.add_argument('--modality', type=str, default='email-formal',
                       choices=['email-formal', 'email-casual', 'slack', 'sms', 'presentation', 'conversation'],
                       help='Communication modality')
    parser.add_argument('--verbose', action='store_true', help='Include diagnostic details')
    
    args = parser.parse_args()
    
    results = analyze(args.text, args.modality)
    
    if not args.verbose:
        # Clean output: just scores
        output = {
            "modality": results["modality"],
            "scores": results["scores"]
        }
        print(json.dumps(output, indent=2))
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
