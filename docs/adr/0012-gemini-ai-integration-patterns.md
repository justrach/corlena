# ADR-0012: Gemini AI Integration Patterns

## Status
Accepted

## Context
Integration with Google's Gemini AI for image generation required careful handling of:
- API response parsing and error handling
- Base64 image data processing
- Asynchronous generation workflows
- User feedback during long-running operations

## Decision
Implement a dedicated `GeminiService` class with robust error handling and response processing:

### Key Design Patterns:
1. **Comprehensive Response Parsing**: Deep inspection of Gemini API response structure
2. **Flexible Image Data Handling**: Support both direct base64 and data URL formats
3. **Extensive Logging**: Debug-friendly logging for response structure analysis
4. **Graceful Error Handling**: User-friendly error messages with detailed technical logging

### Implementation Details:
- Service class pattern for API interaction
- Response validation with fallback error messages
- Base64 data extraction from nested response structure
- Canvas integration through layer management system

### Response Structure Handling:
```javascript
// Expected structure: response.response.candidates[0].content.parts[].inlineData.data
const parts = candidates[0]?.content?.parts || []
for (const part of parts) {
  if (part.inlineData?.data) {
    return part.inlineData.data // Base64 image data
  }
}
```

## Consequences

### Positive:
- Robust handling of complex API responses
- Clear separation between AI service and canvas logic
- Detailed error reporting for debugging
- Flexible image format support

### Negative:
- Complex response parsing logic
- Dependency on specific Gemini API response structure
- Potential brittleness if API response format changes

## Implementation Notes
The integration prioritizes reliability and debuggability over simplicity. Extensive logging helps diagnose API response issues, while flexible data handling ensures compatibility with various image formats.
