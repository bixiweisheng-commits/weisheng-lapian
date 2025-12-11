import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ImageResolution } from "../types";

// Helper to get client with dynamic key
const getClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

// 1. Analyze Video Shot (Vision to JSON)
export const analyzeShotFrame = async (apiKey: string, base64Image: string, shotNumber: number) => {
  const ai = getClient(apiKey);
  
  const analysisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      shotNumber: { type: Type.INTEGER },
      duration: { type: Type.STRING, description: "时长估算" },
      content: {
        type: Type.OBJECT,
        properties: {
          visual: { type: Type.STRING, description: "镜头画面具体内容描述" },
          subtext: { type: Type.STRING, description: "画面背后的涵义或隐喻" }
        }
      },
      environment: {
        type: Type.OBJECT,
        properties: {
          shotSize: { type: Type.STRING, description: "景别 (如：特写、全景)" },
          lighting: { type: Type.STRING, description: "灯光分析 (光位、光质)" }
        }
      },
      camera: {
        type: Type.OBJECT,
        properties: {
          position: { type: Type.STRING, description: "机位 (如：固定、推轨)" },
          angle: { type: Type.STRING, description: "视角 (如：平视、仰视)" },
          viewpoint: { type: Type.STRING, description: "视点 (如：客观视角、主观POV)" },
          focus: { type: Type.STRING, description: "虚实 (如：浅景深、全焦)" }
        }
      },
      character: {
        type: Type.OBJECT,
        properties: {
          relationships: { type: Type.STRING, description: "人物关系表现" },
          blocking: { type: Type.STRING, description: "人物调度与动作" }
        }
      },
      highlightDesign: { type: Type.STRING, description: "画面的亮点设计或美学特征" },
      props: { type: Type.STRING, description: "关键道具及其作用" },
      sound: {
        type: Type.OBJECT,
        properties: {
          dialogue: { type: Type.STRING, description: "潜在台词或旁白风格" },
          sfx: { type: Type.STRING, description: "关键音效" },
          music: { type: Type.STRING, description: "配乐风格建议" }
        }
      },
      editing: { type: Type.STRING, description: "剪辑点或转场建议" },
      mjPrompt: { type: Type.STRING, description: "Midjourney English Prompt (High quality)" },
    },
    required: ["content", "environment", "camera", "character", "sound", "mjPrompt"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: `你是一位专业的电影拉片师。请分析这个第 #${shotNumber} 号镜头。
          
          请严格根据Schema填写每一项：
          - 镜头内容：描述画面内容和深层涵义。
          - 环境：景别和灯光。
          - 相机：机位、视角、视点、虚实。
          - 人物：关系和调度。
          - 声音：分析画面暗示的声音元素。
          - mjPrompt：必须是英文。
          ` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "你是一个专业的电影拉片助手。请用中文回答所有分析内容，但Midjourney提示词保持英文。分析要专业、精准。",
      }
    });

    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

// 2. Generate Image
export const generateImageFromPrompt = async (apiKey: string, prompt: string, resolution: ImageResolution) => {
  const ai = getClient(apiKey);
  const model = "gemini-3-pro-image-preview";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          imageSize: resolution,
          aspectRatio: "16:9" 
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
};

// 3. Edit Image
export const editImageWithPrompt = async (apiKey: string, base64Image: string, editPrompt: string) => {
  const ai = getClient(apiKey);
  const cleanBase64 = base64Image.split(',')[1] || base64Image;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: editPrompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Editing failed:", error);
    throw error;
  }
};

// 4. Chat Bot
export const sendChatMessage = async (apiKey: string, history: any[], message: string) => {
  const ai = getClient(apiKey);
  const chat = ai.chats.create({
    model: "gemini-3-pro-preview",
    history: history,
    config: {
      systemInstruction: "你是一个专业的视频分析软件助手。请用中文回答用户关于电影制作、镜头语言、场面调度和提示词工程的问题。"
    }
  });

  const result = await chat.sendMessage({ message });
  return result.text;
};