export interface ShotAnalysis {
  shotNumber: number;
  duration: string;
  
  // 镜头内容
  content: {
    visual: string; // 内容
    subtext: string; // 涵义
  };
  
  // 环境
  environment: {
    shotSize: string; // 景别
    lighting: string; // 灯光
  };

  // 相机
  camera: {
    position: string; // 机位
    angle: string; // 视角
    viewpoint: string; // 视点
    focus: string; // 虚实
  };

  // 人物
  character: {
    relationships: string; // 人物关系
    blocking: string; // 人物调度
  };

  highlightDesign: string; // 亮点设计
  props: string; // 道具作用

  // 声音
  sound: {
    dialogue: string; // 台词
    sfx: string; // 音效
    music: string; // 音乐
  };

  editing: string; // 剪辑
  mjPrompt: string; // The reverse engineered prompt
}

export interface Shot {
  id: string;
  timestamp: number;
  imageUrl: string; // Base64
  analysis: ShotAnalysis | null;
  isAnalyzing: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum ImageResolution {
  RES_1K = '1K',
  RES_2K = '2K',
  RES_4K = '4K',
}