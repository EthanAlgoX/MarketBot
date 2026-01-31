---
name: ai-portrait-generator
description: Generate ultra-photorealistic portraits using structured JSON prompts. Use when creating AI-generated portraits, character art, or realistic human images with cinematic quality and detailed specifications.
---

# AI Portrait Generator

Generate ultra-photorealistic portraits using structured JSON prompt templates. Based on the professional prompt framework from @lexx_aura, optimized for high-quality AI image generation with Nano Banana Pro and similar models.

## When to Use This Skill

- Creating realistic portraits for social media avatars
- Generating character art for games or stories
- Producing marketing materials with professional-quality imagery
- Building concept art with precise visual specifications
- Creating cinematic-quality portraits with specific lighting and atmosphere

## Core Capabilities

### 1. Structured Prompt Templates
- JSON-based configuration for precise control
- Modular sections: configuration, subject, apparel, pose, environment, lighting
- Professional photography terminology integration
- Cinematic and ultra-photorealistic style options

### 2. Multi-Dimensional Customization
- Subject demographics and physical attributes
- Detailed hair, skin texture, and facial expressions
- Apparel: outfit styles, accessories, materials
- Pose and action: perspective, movement, reflections
- Environment: location, background elements, atmosphere
- Lighting: type, quality, mood, atmosphere

### 3. Technical Specifications
- Camera settings (lens type, aperture)
- Focus and depth of field
- Rendering engine details (Unreal Engine 5, Octane Render)
- Advanced effects (ray tracing, volumetric lighting, subsurface scattering)

## Quick Start

### Basic Portrait Template

```json
{
  "prompt_configuration": {
    "type": "Ultra Photorealistic Portrait",
    "style": "Cinematic Reality",
    "resolution": "8K"
  },
  "subject": {
    "demographics": "Your description here (e.g., 'Young woman, athletic build')",
    "hair": "Hair description (color, style, texture)",
    "skin_texture": "Skin details (tone, texture, complexion)",
    "facial_expression": "Expression description"
  },
  "apparel": {
    "outfit_style": "Overall style (e.g., 'Casual athleisure')",
    "top": "Top description",
    "bottoms": "Bottoms description",
    "accessories": "Accessories description"
  },
  "pose_and_action": {
    "perspective": "View angle (e.g., 'Three-quarter side profile')",
    "action": "What the subject is doing",
    "reflection": "Any reflections (optional)"
  },
  "environment": {
    "location": "Setting location",
    "background_elements": "Background details",
    "flooring": "Floor description"
  },
  "lighting_and_atmosphere": {
    "lighting_type": "Lighting source",
    "quality": "Light quality and color tone",
    "mood": "Overall mood and atmosphere"
  },
  "technical_specifications": {
    "camera": "Camera type and lens",
    "aperture": "Aperture setting (e.g., 'f/2.8')",
    "focus": "Focus description",
    "render_details": "Rendering engine and effects"
  }
}
```

### Example: Gym Portrait

```json
{
  "prompt_configuration": {
    "type": "Ultra Photorealistic Portrait",
    "style": "Cinematic Reality",
    "resolution": "8K"
  },
  "subject": {
    "demographics": "Young woman, athletic build, fit physique",
    "hair": "Dark brown hair, pulled back into a messy high ponytail, loose strands framing face",
    "skin_texture": "Hyper-realistic skin details, post-workout sheen, glistening with sweat, visible pores",
    "facial_expression": "Exhaling slightly, mouth slightly open, focused gaze, tired but accomplished"
  },
  "apparel": {
    "outfit_style": "Monochromatic pastel pink gym set, athleisure",
    "top": "Tight cropped pink camisole with spaghetti straps",
    "bottoms": "Loose-fitting pink sweatpants with visible drawstring",
    "accessories": "Thin silver necklace"
  },
  "pose_and_action": {
    "perspective": "Three-quarter side profile view facing left",
    "action": "Body checking in a gym mirror, left hand pressing against mirror, right hand lifting shirt hem",
    "reflection": "Partial reflection of arm visible in mirror"
  },
  "environment": {
    "location": "Commercial gym interior",
    "background_elements": "Blurred gym equipment, weight racks, cable machines, dumbbells",
    "flooring": "Black speckled rubber gym flooring"
  },
  "lighting_and_atmosphere": {
    "lighting_type": "Overhead artificial gym lighting",
    "quality": "Warm tungsten tones, creating strong specular highlights on sweaty skin",
    "mood": "Intense, raw, fitness-focused, candid moment"
  },
  "technical_specifications": {
    "camera": "DSLR, 85mm portrait lens",
    "aperture": "f/2.8",
    "focus": "Sharp focus on face and abs, creamy bokeh background",
    "render_details": "Unreal Engine 5, Octane Render, ray tracing, subsurface scattering, volumetric lighting"
  }
}
```

## Common Portrait Styles

### Professional Headshot
```json
{
  "prompt_configuration": {
    "type": "Ultra Photorealistic Portrait",
    "style": "Professional Studio",
    "resolution": "8K"
  },
  "subject": {
    "demographics": "Professional executive, confident expression",
    "facial_expression": "Warm, approachable, confident smile",
    "lighting": "Studio portrait lighting"
  },
  "apparel": {
    "outfit_style": "Business formal",
    "top": "Crisp white shirt or professional blouse",
    "accessories": "Minimal, professional"
  },
  "environment": {
    "location": "Professional studio with neutral background",
    "background_elements": "Subtle gradient backdrop",
    "lighting_and_atmosphere": {
      "lighting_type": "Softbox studio lighting",
      "quality": "Clean, even illumination",
      "mood": "Professional, trustworthy, approachable"
    }
  }
}
```

### Casual Lifestyle
```json
{
  "prompt_configuration": {
    "type": "Ultra Photorealistic Portrait",
    "style": "Natural Light Lifestyle",
    "resolution": "8K"
  },
  "environment": {
    "location": "Outdoor park or café setting",
    "lighting_and_atmosphere": {
      "lighting_type": "Natural golden hour sunlight",
      "quality": "Warm, soft, directional light",
      "mood": "Relaxed, natural, authentic"
    }
  }
}
```

### Cinematic Dramatic
```json
{
  "prompt_configuration": {
    "type": "Ultra Photorealistic Portrait",
    "style": "Cinematic Film Noir",
    "resolution": "8K"
  },
  "lighting_and_atmosphere": {
    "lighting_type": "Low-key dramatic lighting",
    "quality": "High contrast, deep shadows",
    "mood": "Dramatic, mysterious, cinematic"
  },
  "technical_specifications": {
    "camera": "DSLR, 50mm lens",
    "aperture": "f/1.4",
    "render_details": "Film grain, vignette, cinematic color grading"
  }
}
```

## Best Practices

### 1. Be Specific
Use detailed descriptions instead of generic terms:
- ✅ "Dark brown hair, pulled back into a messy high ponytail"
- ❌ "Brown hair"

### 2. Include Texture Details
Add texture information for realism:
- ✅ "Hyper-realistic skin details, visible pores, slight flush on cheeks"
- ❌ "Smooth skin"

### 3. Specify Lighting
Describe lighting quality and effects:
- ✅ "Warm tungsten tones, creating strong specular highlights on skin"
- ❌ "Good lighting"

### 4. Camera Knowledge
Use photography terminology:
- Aperture: f/1.4 (shallow depth of field), f/8 (deep focus)
- Lens: 85mm (portrait), 50mm (standard), 35mm (wide)
- Focus: "Sharp focus on subject's face, creamy bokeh background"

### 5. Atmosphere and Mood
Define the emotional tone:
- ✅ "Intense, raw, fitness-focused, candid moment"
- ✅ "Professional, trustworthy, approachable"
- ❌ "Good vibe"

## Advanced Techniques

### Combining Styles
Mix elements from different styles:
- Take lighting from "Cinematic Dramatic"
- Use environment from "Casual Lifestyle"
- Apply technical specs from "Professional Headshot"

### Seasonal Variations
Adjust lighting and atmosphere:
- Winter: "Cool blue tones, soft diffused overcast light"
- Summer: "Warm golden hour, strong shadows"
- Autumn: "Rich warm tones, golden foliage"
- Spring: "Fresh green tones, soft diffuse light"

### Age and Demographics
Tailor descriptions to target audience:
- Young adults: "Fresh, energetic, contemporary"
- Professionals: "Polished, confident, sophisticated"
- Elders: "Distinguished, wise, warm"

## Tips for Better Results

1. **Start with a template**: Use the provided examples as a foundation
2. **Iterate and refine**: Generate multiple versions with slight variations
3. **Test different AI models**: Results vary across different image generation tools
4. **Use high resolution**: 8K resolution provides best quality
5. **Focus on details**: Small details make portraits more realistic

## Integration with AI Tools

### Nano Banana Pro
This prompt format is optimized for Google's Nano Banana Pro image generation engine, offering superior detail, realism, and style variety.

### Other Compatible Tools
- Midjourney (convert JSON to natural language)
- DALL-E 3 (use as structured prompt)
- Stable Diffusion (use ControlNet for pose control)

## Troubleshooting

### Issue: Generated image doesn't match description
**Solution**: Break down complex descriptions into simpler terms, focus on key visual elements

### Issue: Too much detail, image looks cluttered
**Solution**: Reduce environmental elements, simplify background descriptions

### Issue: Lighting looks flat
**Solution**: Add specific light source details (e.g., "warm tungsten", "cool blue rim light")

### Issue: Face doesn't match expression
**Solution**: Use more specific facial cues (e.g., "corner of mouth slightly raised", "eyebrows slightly furrowed")

## Examples in Action

See the original Twitter post by @lexx_aura for a working example:
https://x.com/lexx_aura/status/2016947883807850906

This template generated high-quality ultra-photorealistic portraits using the JSON structure above.

---

*Generated from @lexx_aura's ultra-photorealistic portrait template*
*Twitter: 877 likes, 56 retweets, 544 bookmarks*
*Last updated: 2026-01-30*
