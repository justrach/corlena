# ADR-0011: Figma-Inspired UI Design System

## Status
Accepted

## Context
The original UI had several issues:
- Dark theme with flashy gradients that looked unprofessional
- Poor visual hierarchy and inconsistent spacing
- Overly complex styling that distracted from functionality
- Not aligned with modern design tool aesthetics

User feedback: "why is the sidebar looking funky think of this like a design engineer and just make it easier and better to edit things lol not change the colors to some ugly ass mf"

## Decision
Redesign the UI following clean, professional design principles inspired by tools like Figma:

### Design Principles:
1. **Clean & Minimal**: White backgrounds with subtle gray accents
2. **Functional First**: Remove decorative elements that don't serve a purpose
3. **Consistent Interactions**: Hover states, transitions, and feedback patterns
4. **Professional Aesthetics**: Avoid flashy gradients in favor of clean, purposeful design

### Specific Changes:
- **Sidebar**: White background with subtle borders instead of dark gradients
- **Buttons**: Clean styling with proper disabled states and hover feedback
- **Layer Panel**: Minimal design with hover-revealed actions
- **Selection Indicators**: Professional blue accents instead of purple/pink
- **Typography**: Consistent hierarchy with proper font weights and sizes

## Consequences

### Positive:
- Professional appearance suitable for design tools
- Better usability with clearer visual hierarchy
- Reduced visual noise allows focus on content
- Consistent with user expectations from modern design tools

### Negative:
- Less "branded" appearance (more generic looking)
- Some users might prefer more colorful/distinctive styling
- Required significant rework of existing styling

## Implementation Notes
The redesign prioritizes usability and professionalism over visual distinctiveness. The clean aesthetic allows users to focus on their work rather than the interface.
