import { Router } from 'express';
import { z } from 'zod';
import { ANTHROPIC_MESSAGES_MODEL } from '@/constants/anthropic-messages-model';
import { extractAccountValuesFromImage } from '../services/anthropic';
import { log, error } from '../log';
import { AuthRequest } from '../auth/types';

const processImageSchema = z.object({
  imageData: z.string(),
  providerNames: z.array(z.string()),
});

export async function registerRoutes(router: Router) {
  router.post('/extract-values', async (req: AuthRequest, res) => {
    try {
      const validatedData = processImageSchema.parse(req.body);
      
      // Validate that imageData is a base64 encoded string
      if (!validatedData.imageData.startsWith('data:image')) {
        return res.status(400).json({ 
          error: 'Invalid image format. Please provide a base64 encoded image.' 
        });
      }
      
      // Extract the base64 data part from the string (after the comma)
      const base64Data = validatedData.imageData.split(',')[1];
      if (!base64Data) {
        return res.status(400).json({ 
          error: 'Invalid image data format.' 
        });
      }
      
      // Process the image
      const extractedValues = await extractAccountValuesFromImage(
        base64Data,
        validatedData.providerNames
      );
      
      return res.status(200).json({ extractedValues });
    } catch (err: any) {
      error(`Error processing image: ${err}`);
      console.log('Error details:', JSON.stringify(err));
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: err.errors 
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to process image',
        message: err.message || 'Unknown error' 
      });
    }
  });

  // Add a test endpoint to diagnose API issues
  router.get('/test-api', async (req: AuthRequest, res) => {
    try {
      const anthropic = new (await import('@anthropic-ai/sdk')).default({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MESSAGES_MODEL,
        max_tokens: 100,
        messages: [{ role: "user", content: "Hello, can you respond with just the word 'working'?" }],
      });
      
      // Handle the response properly
      const textBlock = response.content[0] as { type: string; text: string };
      const responseText = textBlock.type === 'text' ? textBlock.text : 'Response received (not text)';
      
      return res.status(200).json({ 
        status: 'success',
        message: responseText,
        model: ANTHROPIC_MESSAGES_MODEL
      });
    } catch (err: any) {
      console.log('API test error:', JSON.stringify(err));
      return res.status(500).json({ 
        status: 'error',
        error: err.message || 'Unknown error',
        details: err
      });
    }
  });

  return router;
}
