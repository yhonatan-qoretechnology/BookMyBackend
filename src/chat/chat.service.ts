import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  async getAiResponse(messages: any[]) {
    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
          }),
        },
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error conectando con OpenAI:', error);
      throw new HttpException(
        'Error en el asistente',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
