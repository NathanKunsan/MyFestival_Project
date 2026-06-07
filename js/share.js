// MyFestival - Share Card & Share Analytics Service
import { getSupabase } from './supabase.js';

// Log sharing event to database
export const logShare = async (messageId, shareType) => {
  const supabase = await getSupabase();
  if (!supabase) return;
  
  try {
    await supabase.from('shares').insert({
      message_id: messageId,
      share_type: shareType // 'url' or 'card'
    });
  } catch (error) {
    console.error('Failed to log share event:', error);
  }
};

// Generate and draw a beautiful Sketchbook card on a canvas
export const drawShareCard = async (canvas, text, signature, festivalName) => {
  const ctx = canvas.getContext('2d');
  
  // Set high resolution card sizes (Square 800x800 for social media)
  canvas.width = 800;
  canvas.height = 800;
  
  // 1. Draw Paper background
  ctx.fillStyle = '#faf6ee'; // Warm cream paper
  ctx.fillRect(0, 0, 800, 800);
  
  // 2. Draw notebook lined paper lines
  ctx.strokeStyle = '#ebdcb9'; // Soft yellow-brown lines
  ctx.lineWidth = 1.5;
  for (let y = 100; y < 700; y += 40) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(720, y);
    ctx.stroke();
  }
  
  // Red notebook vertical margin line
  ctx.strokeStyle = '#e88b74'; // Soft red
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 80);
  ctx.lineTo(120, 720);
  ctx.stroke();

  // 3. Draw hand-drawn organic borders (double stroke)
  drawOrganicRect(ctx, 50, 50, 700, 700, '#4a3c31', 4);
  drawOrganicRect(ctx, 58, 58, 684, 684, '#4a3c31', 1.5);
  
  // 4. Draw Cute Doodles
  drawLittleDoodles(ctx);

  // 5. Draw Festival Label
  ctx.fillStyle = '#f0c365'; // Mustard yellow background for label
  ctx.strokeStyle = '#4a3c31';
  ctx.lineWidth = 2.5;
  
  // Draw irregular badge shape for festival title
  ctx.beginPath();
  ctx.roundRect(150, 80, 500, 50, [20, 5, 20, 5]);
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = '#4a3c31';
  ctx.font = "bold 24px 'Itim', 'Mali', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText(`✨ เทศกาล: ${festivalName} ✨`, 400, 113);

  // 6. Draw Wishing Text
  ctx.fillStyle = '#4a3c31';
  ctx.font = "italic 32px 'Itim', 'Mali', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const wrappedLines = wrapText(ctx, `"${text}"`, 500);
  const startY = 400 - ((wrappedLines.length - 1) * 25);
  
  wrappedLines.forEach((line, idx) => {
    ctx.fillText(line, 400, startY + (idx * 50));
  });

  // 7. Draw Signature
  ctx.font = "bold 26px 'Itim', 'Mali', sans-serif";
  ctx.textAlign = 'right';
  const displaySig = signature && signature.trim() !== '' ? signature : 'ผู้ปรารถนาดี';
  ctx.fillText(`— จาก ${displaySig}`, 650, 630);

  // 8. Draw MyFestival Logo Watermark at bottom
  ctx.fillStyle = '#7c6858';
  ctx.font = "bold 18px 'Itim', 'Mali', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('✏️ สร้างการ์ดส่งต่อความสุขโดย MyFestival', 400, 735);
};

// Helper: Wrap text correctly based on max width in Canvas
function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  let lines = [];
  let currentLine = '';
  
  // Simple word-by-word/char-by-char wrap for Thai compatibility
  let currentWord = '';
  const tokens = text.split(' '); // split by space if any
  
  // If no spaces (like standard Thai), wrap by length/characters
  if (tokens.length <= 1) {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  } else {
    // Wrap English / spaced text
    for (let n = 0; n < tokens.length; n++) {
      const testLine = currentLine + tokens[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(currentLine.trim());
        currentLine = tokens[n] + ' ';
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine.trim());
  }
  
  return lines;
}

// Helper: Draw slightly wavy rectangle for pencil look
function drawOrganicRect(ctx, x, y, width, height, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  
  // Top line
  ctx.moveTo(x, y);
  for (let i = 0; i <= width; i += 30) {
    const targetX = x + i;
    const targetY = y + (Math.random() - 0.5) * 2.5;
    ctx.lineTo(targetX, targetY);
  }
  
  // Right line
  for (let i = 0; i <= height; i += 30) {
    const targetX = x + width + (Math.random() - 0.5) * 2.5;
    const targetY = y + i;
    ctx.lineTo(targetX, targetY);
  }
  
  // Bottom line
  for (let i = width; i >= 0; i -= 30) {
    const targetX = x + i;
    const targetY = y + height + (Math.random() - 0.5) * 2.5;
    ctx.lineTo(targetX, targetY);
  }
  
  // Left line
  for (let i = height; i >= 0; i -= 30) {
    const targetX = x + (Math.random() - 0.5) * 2.5;
    const targetY = y + i;
    ctx.lineTo(targetX, targetY);
  }
  
  ctx.closePath();
  ctx.stroke();
}

// Helper: Draw some cute little doodles in the margins
function drawLittleDoodles(ctx) {
  ctx.strokeStyle = '#bca0d3'; // Soft purple for heart
  ctx.lineWidth = 2;
  
  // Heart in top left margin
  ctx.beginPath();
  ctx.moveTo(100, 160);
  ctx.bezierCurveTo(90, 145, 75, 145, 75, 160);
  ctx.bezierCurveTo(75, 175, 100, 195, 100, 200);
  ctx.bezierCurveTo(100, 195, 125, 175, 125, 160);
  ctx.bezierCurveTo(125, 145, 110, 145, 100, 160);
  ctx.stroke();
  
  // Flower in bottom right margin
  ctx.strokeStyle = '#8ab580'; // Soft green stem
  ctx.beginPath();
  ctx.moveTo(690, 680);
  ctx.quadraticCurveTo(680, 650, 695, 620);
  ctx.stroke();
  
  ctx.fillStyle = '#e4a1b9'; // Pink petals
  ctx.beginPath();
  ctx.arc(695, 615, 8, 0, Math.PI * 2);
  ctx.arc(687, 608, 8, 0, Math.PI * 2);
  ctx.arc(695, 600, 8, 0, Math.PI * 2);
  ctx.arc(703, 608, 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#f0c365'; // Yellow core
  ctx.beginPath();
  ctx.arc(695, 608, 6, 0, Math.PI * 2);
  ctx.fill();
}
