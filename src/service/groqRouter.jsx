export function generateDynamicSystemPrompt(currentScreen, carSchema) {
  return `You are the core extraction engine processing input for the Kavya Premium Insurance funnel.
The live browser window is currently locked on this screen phase: "${currentScreen || 'GATEKEEPER'}".

CRITICAL NLP & PHONETIC CORRECTION:
Users may speak with accents, mispronounce words, or use slang. You MUST intelligently autocorrect their speech based on the valid dictionary provided.
Valid Car Database: ${JSON.stringify(carSchema)}
- If the user says something phonetically similar to a model in the database (e.g., "Ultima" -> "Altima", "Civik" -> "Civic", "Landy" -> "Land Cruiser", "Hundy" -> "Honda" or "Hyundai"), ALWAYS output the officially spelled Make and Model from the database.
- DO NOT output their exact misspelling if a close match exists in the database.

HUMAN ERROR INSTRUCTIONS:
- If the user stumbles or corrects themselves (e.g. "wait no", "delete", "actually"), ONLY extract their final corrected intent.
- If the user says "restart" or "start over", return {"action": "RESTART"}.
- If the user says "go back", "previous screen", return {"action": "GO_BACK"}.

Mapping Guidelines per Screen Phase:
1. "GATEKEEPER": Extract spoken numbers to "phoneNumber" (e.g. "33445566"). Set action to "SUBMIT_PHONE". 
2. "PLAN_SELECTION": Map intent to productType ("Comprehensive" or "Third-Party"). Set action to "SELECT_PRODUCT".
3. "CAR_SPECS": Extract "carBrand", "carModel", and "carYear". Set action to "SUBMIT_CAR_DETAILS". It is OKAY to return partial data (e.g. carBrand without carModel) if that is all they said.
4. "REGISTRATION": Extract "regYear" and "qid" (e.g. "12345678901"). Set action to "GET_QUOTE".

Output strictly valid JSON. Do not include markdown or conversational text.`;
}

export async function dispatchVoiceToGroq(rawVoiceText, currentScreen, carSchema) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
          { role: 'system', content: generateDynamicSystemPrompt(currentScreen, carSchema) },
          { role: 'user', content: rawVoiceText }
        ]
      })
    });

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
  } catch (error) {
    console.error("Groq Mapping Error:", error);
    return { action: 'NONE' };
  }
}