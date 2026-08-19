const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

const replacements = [
  // Gradients
  [/background:\s*['"`]linear-gradient\([^)]+\)['"`]/g, 'background: "#000000"'],
  [/background:\s*['"`]radial-gradient\([^)]+\)['"`](,\s*radial-gradient\([^)]+\))?/g, 'background: "#ffffff"'],
  
  // Backgrounds
  [/(background|backgroundColor):\s*['"`]#0a0d14['"`]/g, '$1: "#ffffff"'],
  [/(background|backgroundColor):\s*['"`]#0f1522['"`]/g, '$1: "#f9fafb"'],
  [/(background|backgroundColor):\s*['"`]#131a2a['"`]/g, '$1: "#ffffff"'],
  [/(background|backgroundColor):\s*['"`]#1a2235['"`]/g, '$1: "#f3f4f6"'],
  [/background:\s*['"`]rgba\(10,\s*13,\s*20,\s*0\.85\)['"`]/g, 'background: "rgba(255, 255, 255, 0.9)"'],
  
  // Text colors
  [/color:\s*['"`]#f1f5f9['"`]/g, 'color: "#000000"'],
  [/color:\s*['"`]#94a3b8['"`]/g, 'color: "#4b5563"'],
  [/color:\s*['"`]#64748b['"`]/g, 'color: "#6b7280"'],
  [/color:\s*['"`]#475569['"`]/g, 'color: "#374151"'],
  [/color:\s*['"`]#334155['"`]/g, 'color: "#111827"'],
  [/color:\s*['"`]#e2e8f0['"`]/g, 'color: "#000000"'],
  
  // Accents (Indigo/Violet)
  [/(color|background|borderColor):\s*['"`]#6366f1['"`]/g, '$1: "#000000"'],
  [/(color|background|borderColor):\s*['"`]#8b5cf6['"`]/g, '$1: "#000000"'],
  [/(color|background|borderColor):\s*['"`]#a78bfa['"`]/g, '$1: "#4b5563"'],
  [/rgba\(99,\s*102,\s*241,\s*0\.\d+\)/g, '"rgba(0,0,0,0.1)"'],
  [/rgba\(99,102,241,0\.\d+\)/g, '"rgba(0,0,0,0.1)"'],
  
  // Other colors (Success, Danger, Warning) - converting to grayscale for B&W minimalist look
  [/(color|background|borderColor):\s*['"`]#10b981['"`]/g, '$1: "#000000"'], // Green -> Black
  [/rgba\(16,\s*185,\s*129,\s*0\.\d+\)/g, '"rgba(0,0,0,0.05)"'],
  [/rgba\(16,185,129,0\.\d+\)/g, '"rgba(0,0,0,0.05)"'],
  
  [/(color|background|borderColor):\s*['"`]#ef4444['"`]/g, '$1: "#000000"'], // Red -> Black
  [/rgba\(239,\s*68,\s*68,\s*0\.\d+\)/g, '"rgba(0,0,0,0.05)"'],
  
  [/(color|background|borderColor):\s*['"`]#f59e0b['"`]/g, '$1: "#000000"'], // Orange -> Black
  [/rgba\(245,\s*158,\s*11,\s*0\.\d+\)/g, '"rgba(0,0,0,0.05)"'],
  
  [/(color|background|borderColor):\s*['"`]#f97316['"`]/g, '$1: "#000000"'], // Orange -> Black
  [/rgba\(249,\s*115,\s*22,\s*0\.\d+\)/g, '"rgba(0,0,0,0.05)"'],
  
  [/(color|background|borderColor):\s*['"`]#3b82f6['"`]/g, '$1: "#000000"'], // Blue -> Black
  
  // Borders
  [/border:\s*['"`]1px solid rgba\(255,255,255,0\.06\)['"`]/g, 'border: "1px solid #e5e7eb"'],
  [/borderColor:\s*['"`]rgba\(255,255,255,0\.06\)['"`]/g, 'borderColor: "#e5e7eb"'],
  [/borderBottom:\s*['"`]1px solid rgba\(255,255,255,0\.06\)['"`]/g, 'borderBottom: "1px solid #e5e7eb"'],
  [/borderTop:\s*['"`]1px solid rgba\(255,255,255,0\.06\)['"`]/g, 'borderTop: "1px solid #e5e7eb"'],
  [/borderRight:\s*['"`]1px solid rgba\(255,255,255,0\.06\)['"`]/g, 'borderRight: "1px solid #e5e7eb"'],
  [/borderLeft:\s*['"`]1px solid rgba\(255,255,255,0\.06\)['"`]/g, 'borderLeft: "1px solid #e5e7eb"'],
  
  // Graph container class name overrides
  [/color="white"/g, 'color="white"'], // SVG icons inside black backgrounds should stay white
  
  // Any remaining rgba whites
  [/rgba\(255,\s*255,\s*255,\s*0\.06\)/g, '"rgba(0,0,0,0.1)"'],
  [/rgba\(255,255,255,0\.06\)/g, '"rgba(0,0,0,0.1)"'],
  [/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, '"rgba(0,0,0,0.1)"'],
  
  // Classes in className
  [/className="glass-card"/g, 'className="minimal-card"'],
  [/className="gradient-text"/g, 'className="solid-text"'],
  [/className="gradient-text-danger"/g, 'className="solid-text"'],
];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content;
      for (const [regex, replacement] of replacements) {
        newContent = newContent.replace(regex, replacement);
      }
      if (content !== newContent) {
        console.log(`Updated ${fullPath}`);
        fs.writeFileSync(fullPath, newContent);
      }
    }
  }
}

walk(srcDir);
