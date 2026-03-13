import type {
  Modality,
  ModelInfo,
  ChatOptions,
  ImageOptions,
  VideoOptions,
  SpeakOptions,
  NoosphereResult,
  NoosphereStream,
} from '../types.js';

export interface NoosphereProvider {
  readonly id: string;
  readonly name: string;
  readonly modalities: Modality[];
  readonly isLocal: boolean;

  ping(): Promise<boolean>;
  listModels(modality?: Modality): Promise<ModelInfo[]>;

  chat?(options: ChatOptions): Promise<NoosphereResult>;
  stream?(options: ChatOptions): NoosphereStream;
  image?(options: ImageOptions): Promise<NoosphereResult>;
  video?(options: VideoOptions): Promise<NoosphereResult>;
  speak?(options: SpeakOptions): Promise<NoosphereResult>;

  dispose?(): Promise<void>;
}
