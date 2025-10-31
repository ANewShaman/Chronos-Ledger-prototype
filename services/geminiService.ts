import { GoogleGenAI, Type } from "@google/genai";
import type { AIAuditResult } from '../types';
import { historicalCsvData } from '../data/historicalData';


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const auditSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        batchId: {
          type: Type.STRING,
          description: 'The batch ID from the new CSV row being audited.',
        },
        productName: {
          type: Type.STRING,
          description: 'The product name from the new CSV row.',
        },
        isCompliant: {
          type: Type.BOOLEAN,
          description: 'True if the entry is compliant and passes all checks, false otherwise.',
        },
        reason: {
            type: Type.STRING,
            description: 'A detailed explanation for the compliance status. If compliant, state "OK". If not, explain the specific rule violation or the reason for the anomalous flag based on historical context.'
        }
      },
      required: ['batchId', 'productName', 'isCompliant', 'reason'],
    },
};

const buildPrompt = (newCsvData: string): string => {
    return `
      You are a highly critical AI auditor for a pharmaceutical supply chain system. Your primary goal is to prevent counterfeit or non-compliant products from entering the supply chain. Analyze the "New Batch Data" against a set of strict rules and the "Historical Batch Data" provided for context.

      **HISTORICAL BATCH DATA (for context):**
      \`\`\`csv
      ${historicalCsvData}
      \`\`\`

      **CRITICAL COMPLIANCE RULES:**
      1.  **Batch ID Format:** Must strictly follow the format for the given product name based on historical data (e.g., 'BCH-...' for Essential Medicine X, 'IB-...' for ImmunoBoost, 'CCP-...' for CardioCare Plus). Any deviation is a critical failure.
      2.  **Manufacturing Date:** Must be a valid date in YYYY-MM-DD format. The date CANNOT be in the future.
      3.  **Manufacturing on Weekends:** Manufacturing is not allowed on Saturdays or Sundays. Flag any batch with a manufacturing date falling on a weekend.
      4.  **Recalled Products:** If a product name has ever been associated with a "Recalled" status in the historical data, ANY new batch of that same product must be flagged for manual review.
      5.  **Location Anomaly:** If a product is manufactured in a location ('ALPHA', 'DELTA', 'GAMMA', 'OMEGA') where it has not been manufactured before according to historical data, flag it as an anomaly.
      6.  **Similarity to Flagged Batches:** Be EXTRA CRITICAL. If a new batch shares a ProductName and Location with any historical batch that was 'Flagged-Temp' or 'Under Investigation', you must flag the new batch and cite the historical precedent as the reason.

      **YOUR TASK:**
      Analyze each row of the following "New Batch Data". For each row, determine if it is compliant based on ALL the rules and historical context. Return your findings as a JSON array that adheres to the provided schema.

      **NEW BATCH DATA (to be audited):**
      \`\`\`csv
      ${newCsvData}
      \`\`\`
    `;
};


export const runAIAudit = async (csvData: string): Promise<AIAuditResult> => {
    
    const model = 'gemini-2.5-flash';
    const prompt = buildPrompt(csvData);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: auditSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (!Array.isArray(result)) {
            throw new Error("AI response was not a valid JSON array.");
        }

        return result as AIAuditResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`AI service failed: ${error.message}`);
        }
        throw new Error("An unknown error occurred with the AI service.");
    }
};
