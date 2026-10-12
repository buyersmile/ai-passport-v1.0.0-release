import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// API Endpoint สำหรับวิเคราะห์ข้อมูลด้วย Ollama
app.post('/api/live-analyze', async (req, res) => {
  try {
    const { prompt, model = 'qwen2.5:3b', image } = req.body;

    const payload: any = {
      model: model,
      prompt: prompt,
      stream: false,
      format: 'json'
    };

    if (image) {
      payload.images = [image];
    }

    // เรียกไปยัง Ollama Service บน localhost
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json({ success: true, result: JSON.parse(data.response) });
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
