// =====================================================
// AI PROVIDER ABSTRACTION LAYER
// Pluggable AI provider selection (OpenAI, Anthropic, AWS Bedrock, Mock)
// Configured via AI_PROVIDER environment variable
// =====================================================

require('dotenv').config();

// =====================================================
// AI PROVIDER FACTORY
// Returns the appropriate provider based on configuration
// Supports: openai, anthropic, bedrock, mock
// =====================================================

/**
 * GET AI PROVIDER INSTANCE
 * Returns configured AI provider based on AI_PROVIDER env var
 * Defaults to 'mock' if not specified or invalid
 */
function getAIProvider() {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'bedrock':
      return new BedrockProvider();
    case 'mock':
    default:
      return new MockProvider();
  }
}

// =====================================================
// MOCK PROVIDER (for testing - no API calls)
// Returns deterministic responses without external API calls
// =====================================================
class MockProvider {
  constructor() {
    this.name = 'mock';
  }
  
  /**
   * GENERATE REORDER ADVICE
   * Analyzes stock levels and suggests reorders
   * Mock returns deterministic advice based on input
   */
  async generateReorderAdvice(stockData) {
    // MOCK: ANALYZE STOCK AND GENERATE ADVICE
    const advice = [];
    
    for (const item of stockData) {
      if (item.quantity < item.reorder_level) {
        const suggestedQuantity = item.reorder_level * 2 - item.quantity;
        advice.push({
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          warehouse_id: item.warehouse_id,
          warehouse_name: item.warehouse_name,
          current_quantity: item.quantity,
          reorder_level: item.reorder_level,
          suggested_order_quantity: suggestedQuantity,
          priority: item.quantity === 0 ? 'HIGH' : 'MEDIUM',
          reason: `Stock below reorder level (${item.quantity} < ${item.reorder_level})`
        });
      }
    }
    
    return {
      provider: this.name,
      advice: advice,
      summary: `${advice.length} product(s) need reordering`
    };
  }
  
  /**
   * ANSWER QUESTION
   * Answers general questions about inventory
   * Mock returns a simple canned response
   */
  async answerQuestion(question, context) {
    // MOCK: RETURN DETERMINISTIC ANSWER
    return {
      provider: this.name,
      question: question,
      answer: `Based on the current inventory data, I can see ${context.total_products} products across ${context.total_warehouses} warehouses. ${context.low_stock_count} items are below reorder level. This is a mock response for testing.`,
      context_used: context
    };
  }
}

// =====================================================
// OPENAI PROVIDER
// Uses OpenAI GPT models via official SDK
// Requires: OPENAI_API_KEY environment variable
// =====================================================
class OpenAIProvider {
  constructor() {
    this.name = 'openai';
    
    // IMPORT OPENAI SDK ONLY WHEN NEEDED
    const { OpenAI } = require('openai');
    
    // CHECK FOR API KEY
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
    }
    
    // INITIALIZE OPENAI CLIENT
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  /**
   * GENERATE REORDER ADVICE USING OPENAI
   * Sends stock data to GPT and gets reorder recommendations
   */
  async generateReorderAdvice(stockData) {
    // STEP 1: BUILD PROMPT WITH STOCK DATA
    const prompt = `You are an inventory management AI assistant. Analyze the following stock data and provide reorder recommendations in JSON format.

Stock Data:
${JSON.stringify(stockData, null, 2)}

For each product below reorder level, provide:
- product_id, product_name, sku
- warehouse_id, warehouse_name
- current_quantity, reorder_level
- suggested_order_quantity (to bring stock above reorder level)
- priority (HIGH if out of stock, MEDIUM otherwise)
- reason

Return ONLY a JSON object with format: { "advice": [...] }`;
    
    // STEP 2: CALL OPENAI API
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an inventory management expert. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });
    
    // STEP 3: PARSE RESPONSE
    const content = response.choices[0].message.content;
    const parsedResponse = JSON.parse(content);
    
    return {
      provider: this.name,
      ...parsedResponse
    };
  }
  
  /**
   * ANSWER QUESTION USING OPENAI
   * Uses GPT to answer questions about inventory
   */
  async answerQuestion(question, context) {
    // STEP 1: BUILD PROMPT WITH CONTEXT
    const prompt = `You are an inventory management AI assistant. Answer the following question based on the provided context.

Context:
${JSON.stringify(context, null, 2)}

Question: ${question}

Provide a clear, concise answer based on the context data.`;
    
    // STEP 2: CALL OPENAI API
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an inventory management expert.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });
    
    // STEP 3: RETURN ANSWER
    return {
      provider: this.name,
      question: question,
      answer: response.choices[0].message.content,
      context_used: context
    };
  }
}

// =====================================================
// ANTHROPIC PROVIDER
// Uses Claude models via Anthropic SDK
// Requires: ANTHROPIC_API_KEY environment variable
// =====================================================
class AnthropicProvider {
  constructor() {
    this.name = 'anthropic';
    
    // IMPORT ANTHROPIC SDK ONLY WHEN NEEDED
    const Anthropic = require('@anthropic-ai/sdk');
    
    // CHECK FOR API KEY
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic provider');
    }
    
    // INITIALIZE ANTHROPIC CLIENT
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  
  /**
   * GENERATE REORDER ADVICE USING CLAUDE
   * Sends stock data to Claude and gets recommendations
   */
  async generateReorderAdvice(stockData) {
    // STEP 1: BUILD PROMPT WITH STOCK DATA
    const prompt = `You are an inventory management AI assistant. Analyze the following stock data and provide reorder recommendations in JSON format.

Stock Data:
${JSON.stringify(stockData, null, 2)}

For each product below reorder level, provide:
- product_id, product_name, sku
- warehouse_id, warehouse_name
- current_quantity, reorder_level
- suggested_order_quantity (to bring stock above reorder level)
- priority (HIGH if out of stock, MEDIUM otherwise)
- reason

Return ONLY a JSON object with format: { "advice": [...] }`;
    
    // STEP 2: CALL ANTHROPIC API
    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    // STEP 3: PARSE RESPONSE
    const content = response.content[0].text;
    const parsedResponse = JSON.parse(content);
    
    return {
      provider: this.name,
      ...parsedResponse
    };
  }
  
  /**
   * ANSWER QUESTION USING CLAUDE
   * Uses Claude to answer questions about inventory
   */
  async answerQuestion(question, context) {
    // STEP 1: BUILD PROMPT WITH CONTEXT
    const prompt = `You are an inventory management AI assistant. Answer the following question based on the provided context.

Context:
${JSON.stringify(context, null, 2)}

Question: ${question}

Provide a clear, concise answer based on the context data.`;
    
    // STEP 2: CALL ANTHROPIC API
    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    // STEP 3: RETURN ANSWER
    return {
      provider: this.name,
      question: question,
      answer: response.content[0].text,
      context_used: context
    };
  }
}

// =====================================================
// AWS BEDROCK PROVIDER
// Uses Claude via AWS Bedrock service
// Requires: AWS credentials and region environment variables
// =====================================================
class BedrockProvider {
  constructor() {
    this.name = 'bedrock';
    
    // IMPORT AWS SDK ONLY WHEN NEEDED
    const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    
    // CHECK FOR AWS CREDENTIALS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are required for Bedrock provider');
    }
    
    // INITIALIZE BEDROCK CLIENT
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    this.modelId = process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
  }
  
  /**
   * GENERATE REORDER ADVICE USING BEDROCK
   * Invokes Claude via AWS Bedrock
   */
  async generateReorderAdvice(stockData) {
    // STEP 1: BUILD PROMPT
    const prompt = `You are an inventory management AI assistant. Analyze the following stock data and provide reorder recommendations in JSON format.

Stock Data:
${JSON.stringify(stockData, null, 2)}

For each product below reorder level, provide:
- product_id, product_name, sku
- warehouse_id, warehouse_name
- current_quantity, reorder_level
- suggested_order_quantity
- priority (HIGH if out of stock, MEDIUM otherwise)
- reason

Return ONLY a JSON object with format: { "advice": [...] }`;
    
    // STEP 2: BUILD BEDROCK REQUEST
    const input = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    };
    
    // STEP 3: INVOKE MODEL
    const command = new InvokeModelCommand(input);
    const response = await this.client.send(command);
    
    // STEP 4: PARSE RESPONSE
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;
    const parsedResponse = JSON.parse(content);
    
    return {
      provider: this.name,
      ...parsedResponse
    };
  }
  
  /**
   * ANSWER QUESTION USING BEDROCK
   * Uses Claude via Bedrock to answer questions
   */
  async answerQuestion(question, context) {
    // STEP 1: BUILD PROMPT
    const prompt = `You are an inventory management AI assistant. Answer the following question based on the provided context.

Context:
${JSON.stringify(context, null, 2)}

Question: ${question}

Provide a clear, concise answer based on the context data.`;
    
    // STEP 2: BUILD BEDROCK REQUEST
    const input = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    };
    
    // STEP 3: INVOKE MODEL
    const command = new InvokeModelCommand(input);
    const response = await this.client.send(command);
    
    // STEP 4: PARSE RESPONSE
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const answer = responseBody.content[0].text;
    
    return {
      provider: this.name,
      question: question,
      answer: answer,
      context_used: context
    };
  }
}

// =====================================================
// EXPORT PROVIDER FACTORY
// =====================================================
module.exports = {
  getAIProvider
};
