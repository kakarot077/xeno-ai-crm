const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/generate-message", async (req, res) => {
  try {
    const { audience, goal } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
You are a marketing expert for a D2C brand.

Write a short, high-conversion CRM message.

Audience: ${audience}
Goal: ${goal}

Return ONLY the message.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ message: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;