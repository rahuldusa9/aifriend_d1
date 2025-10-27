const axios = require('axios');

// Your Gemini API key
const API_KEY = '<API_KEY>';
async function generateText(promptText) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                // The input content array
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: promptText
                            }
                        ]
                    }
                ],
                // CORRECTED FIELD NAME: Use 'generationConfig' for model parameters
                generationConfig: {
                    temperature: 0.7
                }
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const aiResponse = response.data.candidates[0].content.parts[0].text;
        console.log("AI Response:", aiResponse);

    } catch (error) {
        if (error.response) {
            console.error("API returned an error:");
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error("No response received. Check your API key or network.");
            console.error(error.request);
        } else {
            console.error("Request setup error:", error.message);
        }
    }
}

// Example usage
generateText("Explain how AI works in a few words");