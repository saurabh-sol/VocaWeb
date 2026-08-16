export type IntegrationProvider = 'notion' | 'canva' | 'figma';

export interface ImportSource {
  provider: IntegrationProvider;
  externalId: string;
  title?: string;
  url?: string;
  frameId?: string;
  format?: 'png' | 'html_standalone' | 'html_bundle' | 'pdf';
}

export interface ImportBundleSection {
  id: string;
  title: string;
  level: number;
  body: string;
  bullets?: string[];
}

export interface ImportBundle {
  sources: {
    provider: IntegrationProvider;
    externalId: string;
    title?: string;
    url?: string;
  }[];
  markdownContent?: string;
  assets?: {
    path: string;
    url?: string;
    mime?: string;
    projectPath?: string;
  }[];
  designTokens?: {
    colors?: string[];
    fonts?: string[];
    spacing?: number[];
  };
  structuredSections?: ImportBundleSection[];
  layoutSummary?: string;
}

export type VoiceId = 'eve' | 'ara' | 'rex' | 'sal' | 'leo';
