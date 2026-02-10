import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
// Remove these if they are causing duplicates
// import History from '@tiptap/extension-history';
// import BulletList from '@tiptap/extension-bullet-list';
// import OrderedList from '@tiptap/extension-ordered-list';
// import ListItem from '@tiptap/extension-list-item';
// import Paragraph from '@tiptap/extension-paragraph';
// import Text from '@tiptap/extension-text';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered,
  Undo, Redo, Download, Info, CheckCircle2, AlertCircle,
  ZoomIn, ZoomOut, Search, ChevronRight, ChevronDown, X,
  Loader2
} from 'lucide-react';
import { Document, Packer, Paragraph as DocxParagraph, TextRun, AlignmentType, LevelFormat } from 'docx';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HarperExtension, HarperLintResult, harperKey } from './HarperExtension';
import { NorwegianExtension, norwegianKey } from './NorwegianExtension';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Spellcheck language options
type SpellcheckLanguage = 'en' | 'no' | 'off';

// Custom Font Size Extension
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
                'data-font-size': attributes.fontSize, // Add data attribute for easier debugging
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const App = () => {
  // Duplicate tab detection
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);

  useEffect(() => {
    // BroadcastChannel is supported in all modern browsers and SEB's Chromium engine
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('vestby-prove-tab');
    } catch (e) {
      // BroadcastChannel not supported — skip duplicate detection
      console.warn('BroadcastChannel not supported, skipping duplicate tab detection');
      return;
    }

    let isActive = true;

    channel.onmessage = (event) => {
      if (event.data === 'ping' && isActive) {
        // Another tab is asking if anyone is here — reply
        channel!.postMessage('pong');
      } else if (event.data === 'pong' && isActive) {
        // Another tab replied — we are the duplicate
        setIsDuplicateTab(true);
      }
    };

    // Ask if any other tab is already open
    channel.postMessage('ping');

    return () => {
      isActive = false;
      channel?.close();
    };
  }, []);

  // Spellcheck language: 'en' (Harper), 'no' (Norwegian), or 'off'
  const [spellcheckLang, setSpellcheckLang] = useState<SpellcheckLanguage>('en');

  const [isSaved, setIsSaved] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [exportData, setExportData] = useState({ name: '', class: '', subject: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [lintResults, setLintResults] = useState<HarperLintResult[]>([]);
  const [ignoredSpans, setIgnoredSpans] = useState<{ start: number, end: number, text: string }[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [spellcheckStatus, setSpellcheckStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Ctrl+S keyboard shortcut to open export modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowExportModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle auto-save status with proper cleanup
  useEffect(() => {
    if (!isSaved) {
      const timeout = setTimeout(() => setIsSaved(true), 1000);
      return () => clearTimeout(timeout);
    }
  }, [isSaved]);

  const simplifyMessage = useCallback((result: HarperLintResult) => {
    const { category, message, suggestions } = result;

    // Mapping technical terms to friendly Norwegian hints
    const hints: Record<string, string> = {
      // Common English phrases to translate
      "canonical spelling is all-caps": "Sjekk om dette ordet skal ha store bokstaver.",
      "did you mean the closed compound": "Bør dette skrives som ett ord?",
      "closed compound": "Disse ordene bør kanskje skrives sammen.",
      "open compound": "Disse ordene bør kanskje skrives hver for seg.",
      "passive voice": "Prøv å skrive mer direkte (hvem gjør noe?).",
      "determiner": "Sjekk om du mangler et ord som 'en', 'ei' eller 'et'.",
      "split infinitive": "Prøv å ikke sette ord mellom 'å' og verbet.",
      "verbose": "Denne setningen er litt lang. Kan den gjøres kortere?",
      "unnecessary": "Dette ordet er kanskje ikke nødvendig.",
      "cliché": "Dette er et fast uttrykk. Kan du si det på en annen måte?",
      "repeated word": "Du har skrevet dette ordet to ganger på rad.",
      "multiple spaces": "Du har brukt mer enn ett mellomrom her.",
      "sentence case": "Sjekk om dette skal ha liten eller stor bokstav.",
      "an uncategorized rule": "Det kan være en feil her.",
      "avoid starting a sentence": "Prøv å starte setningen på en annen måte.",
      "wrong quotes": "Sjekk om du har brukt riktig type anførselstegn.",
      "sentence appears to be missing": "Denne setningen ser ufullstendig ut.",
      "spelled correctly": "Sjekk stavemåten.",
      "misspelling": "Mulig skrivefeil.",
    };

    // Check for specific technical phrases in the message
    for (const [key, hint] of Object.entries(hints)) {
      if (message.toLowerCase().includes(key)) return hint;
    }

    // Category-based generic hints (Pedagogical approach)
    if (category === 'Spelling') {
      if (suggestions && suggestions.length > 0) return "Mente du en av disse?";
      return "Er det skrevet riktig?";
    }
    if (category === 'Capitalization') return "Sjekk stor/liten bokstav.";
    if (category === 'Punctuation') return "Sjekk tegnsettingen her.";
    if (category === 'Grammar') return "Sjekk grammatikken her.";
    if (category === 'WordChoice') return "Vurder et annet ordvalg.";
    if (category === 'Style') return "Vurder å omformulere.";
    if (category === 'Typo') return "Mulig skrivefeil.";
    if (category === 'Miscellaneous') return "Sjekk dette.";

    // Final fallback - return a generic message instead of English
    return "Sjekk denne teksten.";
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Typography,
      // Conditionally load spellchecker based on language selection
      ...(spellcheckLang === 'en' ? [HarperExtension.configure({
        onResults: (results) => {
          setLintResults(results);
        },
        onStatusChange: (status) => {
          setSpellcheckStatus(status);
        },
      })] : []),
      ...(spellcheckLang === 'no' ? [NorwegianExtension.configure({
        onResults: (results) => {
          setLintResults(results);
        },
        onStatusChange: (status) => {
          setSpellcheckStatus(status);
        },
      })] : []),
    ],
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: (() => {
      try {
        return localStorage.getItem('vestby-prove-content') || '<p></p>';
      } catch (e) {
        console.error('Failed to access localStorage:', e);
        return '<p></p>';
      }
    })(),
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      try {
        localStorage.setItem('vestby-prove-content', content);
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          console.error('LocalStorage quota exceeded! Content might not be saved.');
          // We don't want to panic the student with a big modal, 
          // but we should at least log it and consider a subtle UI hint if this were a production requirement.
        } else {
          console.error('Failed to save content to localStorage:', e);
        }
      }

      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);

      setIsSaved(false);
    },
    onCreate: ({ editor }) => {
      let savedContent: string | null = null;
      try {
        savedContent = localStorage.getItem('vestby-prove-content');
      } catch (e) {
        console.error('Failed to read content from localStorage:', e);
      }

      if (!savedContent) {
        editor.chain().focus().setFontFamily('OpenDyslexic').setMark('textStyle', { fontSize: '14px' }).run();
      }
    },
    editorProps: {
      attributes: {
        // Disable browser spellcheck - we use our own spellcheckers
        spellcheck: 'false',
        class: 'font-opendyslexic outline-none',
      } as any,
    },
  }, [spellcheckLang]);

  // Clear lint results when switching languages to avoid showing stale errors
  useEffect(() => {
    setLintResults([]);
    setSpellcheckStatus('loading');
  }, [spellcheckLang]);

  // Helper to map Harper character offsets to ProseMirror positions
  const getPos = useCallback((charOffset: number, isEnd = false) => {
    if (!editor) return 0;
    const { doc } = editor.state;
    let currentTextPos = 0;
    let targetPos = -1;

    // Optimization: If charOffset is 0, we know it's the start
    if (charOffset === 0 && !isEnd) return 1;

    try {
      doc.descendants((node, pos) => {
        if (targetPos !== -1) return false;
        if (node.isText) {
          const nodeText = node.text || "";
          const nodeEnd = currentTextPos + nodeText.length;

          if (isEnd) {
            if (charOffset > currentTextPos && charOffset <= nodeEnd) {
              targetPos = pos + (charOffset - currentTextPos);
              return false;
            }
          } else {
            if (charOffset >= currentTextPos && charOffset < nodeEnd) {
              targetPos = pos + (charOffset - currentTextPos);
              return false;
            }
          }
          currentTextPos = nodeEnd;
        }
        return true;
      });
    } catch (e) {
      console.error('Error during position mapping:', e);
    }

    // If we didn't find the position, return a safe fallback within document bounds
    if (targetPos === -1) {
      // Ensure we stay within [1, doc.content.size - 1] to avoid invalid position errors
      const safePos = Math.min(Math.max(1, charOffset + 1), Math.max(1, doc.content.size - 1));
      return safePos;
    }

    // Final safety check for ProseMirror position validity
    return Math.min(Math.max(1, targetPos), Math.max(1, doc.content.size - 1));
  }, [editor]);

  const filteredResults = React.useMemo(() => {
    if (!editor || spellcheckLang === 'off') return [];
    return lintResults.filter(result => {
      // Hide style and word choice suggestions to focus on core grammar/spelling
      if (result.category === 'Style' || result.category === 'WordChoice') return false;

      if (result.category === 'Capitalization' && result.suggestions.includes('IDE')) return false;

      const start = getPos(result.span.start);
      const end = getPos(result.span.end, true);
      const currentText = editor.state.doc.textBetween(start, end);

      return !ignoredSpans.some(ignored =>
        ignored.start === result.span.start &&
        ignored.end === result.span.end &&
        ignored.text === currentText
      );
    });
  }, [lintResults, ignoredSpans, editor, getPos, spellcheckLang]);

  const [focusedErrorKey, setFocusedErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (editor && editor.view) {
      const { state } = editor;
      const currentKey = spellcheckLang === 'no' ? norwegianKey : harperKey;

      if (filteredResults.length === 0) {
        const tr = state.tr.setMeta(currentKey, {
          type: 'set-decorations',
          decorations: DecorationSet.empty,
        });
        editor.view.dispatch(tr);
        return;
      }

      const decorations: Decoration[] = [];

      filteredResults.forEach((result: any) => {
        let color = '#ef4444'; // Red for unknown
        if (result.category === 'Typo' || result.category === 'Spelling') color = '#f97316'; // Orange
        if (result.category === 'Grammar') color = '#3b82f6'; // Blue
        if (result.category === 'Style') color = '#eab308'; // Yellow
        if (result.category === 'WordChoice') color = '#22c55e'; // Green

        const errorKey = `${result.span.start}-${result.span.end}`;
        const isFocused = focusedErrorKey === errorKey;

        const startPos = getPos(result.span.start);
        const endPos = getPos(result.span.end, true);

        // Validate positions before creating decoration
        if (startPos >= 1 && endPos > startPos && endPos < state.doc.content.size) {
          decorations.push(Decoration.inline(startPos, endPos, {
            class: cn('harper-error', isFocused && 'harper-error-focused'),
            // Use wavy decoration for "squiggly" effect
            style: `text-decoration: underline wavy ${color} 2px !important; text-underline-offset: 4px !important; background-color: ${isFocused ? color + '40' : color + '15'} !important; cursor: text !important; transition: background-color 0.2s ease;`,
          }));
        }
      });

      const tr = state.tr.setMeta(currentKey, {
        type: 'set-decorations',
        decorations: DecorationSet.create(state.doc, decorations),
      });
      editor.view.dispatch(tr);
    }
  }, [filteredResults, editor, focusedErrorKey, getPos, spellcheckLang]);

  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { from } = editor.state.selection;

      // Find if the cursor is within any error span
      const result = filteredResults.find(r => {
        const start = getPos(r.span.start);
        const end = getPos(r.span.end, true);
        // We check if the cursor (from) is within the start and end positions
        return from >= start && from <= end;
      });

      if (result) {
        const newKey = `${result.span.start}-${result.span.end}`;
        if (focusedErrorKey !== newKey) {
          setFocusedErrorKey(newKey);
          setShowSidebar(true);
        }
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, filteredResults, getPos, focusedErrorKey]);

  useEffect(() => {
    if (focusedErrorKey && showSidebar) {
      const element = document.querySelector(`[data-error-key="${focusedErrorKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedErrorKey, showSidebar]);

  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setIsSaved(true);
    }
  }, [editor]);

  // Store the generated blob for fallback download
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);

  const handlePrepareExport = async () => {
    if (!editor) return;
    console.log('[Vestby Export] Starting export preparation...');
    setIsGenerating(true);
    setDownloadUrl(null);
    setGeneratedBlob(null);
    setExportError(null);

    // Fake non-linear loader for better UX
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600));

    try {
      const baseFontSize = 14;

      // Helper function to extract text runs from a paragraph node
      const getTextRuns = (paragraphNode: any): any[] => {
        return paragraphNode.content?.map((child: any) => {
          let markSize = child.marks?.find((m: any) => m.type === 'fontSize')?.attrs?.fontSize;
          if (!markSize) {
            markSize = child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.fontSize;
          }
          const finalSize = markSize ? parseInt(markSize.replace('px', '')) : baseFontSize;

          return new TextRun({
            text: child.text || '',
            bold: child.marks?.some((m: any) => m.type === 'bold'),
            italics: child.marks?.some((m: any) => m.type === 'italic'),
            underline: child.marks?.some((m: any) => m.type === 'underline') ? {} : undefined,
            size: finalSize * 2,
            font: 'Arial',
          });
        }) || [new TextRun({ text: "", size: baseFontSize * 2 })];
      };

      // Recursively process TipTap nodes into docx paragraphs
      const processNodes = (nodes: any[], listType?: 'bullet' | 'number', depth: number = 0): any[] => {
        const paragraphs: any[] = [];

        nodes?.forEach((node: any) => {
          if (node.type === 'paragraph') {
            // Regular paragraph or paragraph inside a list item
            const paragraph = new DocxParagraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: 360, before: 0, after: 120 },
              bullet: listType === 'bullet' ? { level: depth } : undefined,
              numbering: listType === 'number' ? { reference: 'default-numbering', level: depth } : undefined,
              children: getTextRuns(node),
            });
            paragraphs.push(paragraph);
          } else if (node.type === 'bulletList') {
            // Process bullet list items - route through listItem handler for proper nesting
            node.content?.forEach((listItem: any) => {
              if (listItem.type === 'listItem') {
                paragraphs.push(...processNodes([listItem], 'bullet', depth));
              }
            });
          } else if (node.type === 'orderedList') {
            // Process ordered list items - route through listItem handler for proper nesting
            node.content?.forEach((listItem: any) => {
              if (listItem.type === 'listItem') {
                paragraphs.push(...processNodes([listItem], 'number', depth));
              }
            });
          } else if (node.type === 'listItem') {
            // Direct listItem - check for nested lists inside
            if (node.content) {
              node.content.forEach((childNode: any) => {
                if (childNode.type === 'bulletList' || childNode.type === 'orderedList') {
                  // Nested list - increase depth
                  paragraphs.push(...processNodes([childNode], undefined, depth + 1));
                } else {
                  paragraphs.push(...processNodes([childNode], listType, depth));
                }
              });
            }
          } else {
            // Fallback: try to extract text from unknown node types
            if (node.content) {
              paragraphs.push(...processNodes(node.content, listType, depth));
            }
          }
        });

        return paragraphs;
      };

      const doc = new Document({
        numbering: {
          config: [
            {
              reference: 'default-numbering',
              levels: [
                {
                  level: 0,
                  format: LevelFormat.DECIMAL,
                  text: '%1.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                },
                {
                  level: 1,
                  format: LevelFormat.LOWER_LETTER,
                  text: '%2.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
                },
                {
                  level: 2,
                  format: LevelFormat.LOWER_ROMAN,
                  text: '%3.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 2160, hanging: 360 } } },
                },
                {
                  level: 3,
                  format: LevelFormat.DECIMAL,
                  text: '%4.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 2880, hanging: 360 } } },
                },
                {
                  level: 4,
                  format: LevelFormat.LOWER_LETTER,
                  text: '%5.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 3600, hanging: 360 } } },
                },
                {
                  level: 5,
                  format: LevelFormat.LOWER_ROMAN,
                  text: '%6.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 4320, hanging: 360 } } },
                },
                {
                  level: 6,
                  format: LevelFormat.DECIMAL,
                  text: '%7.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 5040, hanging: 360 } } },
                },
                {
                  level: 7,
                  format: LevelFormat.LOWER_LETTER,
                  text: '%8.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 5760, hanging: 360 } } },
                },
                {
                  level: 8,
                  format: LevelFormat.LOWER_ROMAN,
                  text: '%9.',
                  alignment: AlignmentType.LEFT,
                  style: { paragraph: { indent: { left: 6480, hanging: 360 } } },
                },
              ],
            },
          ],
        },
        sections: [
          {
            properties: {},
            children: processNodes(editor.getJSON().content || []),
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      console.log('[Vestby Export] DOCX blob created, size:', blob.size, 'bytes');

      // Store blob for potential fallback download
      setGeneratedBlob(blob);

      // Convert blob to data URI for better Mac SEB compatibility
      // Data URIs have explicit support in SEB 3.2.3+ whereas blob: URLs often fail
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        console.log('[Vestby Export] Data URI created, length:', dataUri.length);
        setDownloadUrl(dataUri);
      };
      reader.onerror = (e) => {
        // Fallback to blob URL if data URI conversion fails
        console.warn('[Vestby Export] Data URI conversion failed:', e);
        const url = URL.createObjectURL(blob);
        console.log('[Vestby Export] Falling back to blob URL:', url);
        setDownloadUrl(url);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('[Vestby Export] Export failed:', error);
      setExportError('Noe gikk galt under eksportering. Prøv igjen.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fallback download using iframe method (for Mac SEB where data URI <a> fails)
  const handleFallbackDownload = () => {
    if (!generatedBlob) {
      console.warn('[Vestby Export] Fallback called but no blob available');
      return;
    }
    const filename = `${exportData.name.replace(/\s+/g, '-')}_${exportData.class.replace(/\s+/g, '-')}_${exportData.subject.replace(/\s+/g, '-')}.docx`.toLowerCase();
    console.log('[Vestby Export] Attempting iframe fallback download for:', filename);

    // Strategy 1: Try iframe-based download (works in some SEB versions)
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        console.log('[Vestby Export] Iframe method: data URL ready');

        // Create hidden iframe and trigger download
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        document.body.appendChild(iframe);

        try {
          // Some browsers support direct location assign with data URI
          if (iframe.contentWindow) {
            iframe.contentWindow.location.href = dataUrl;
            console.log('[Vestby Export] Iframe location assigned');
          }
        } catch (iframeError) {
          console.warn('[Vestby Export] Iframe assign failed:', iframeError);
        }

        // Clean up iframe after delay
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      };
      reader.onerror = (e) => {
        console.error('[Vestby Export] FileReader error in fallback:', e);
      };
      reader.readAsDataURL(generatedBlob);
    } catch (e) {
      console.error('[Vestby Export] Iframe method failed:', e);
    }

    // Strategy 2: Also try saveAs as parallel attempt
    try {
      console.log('[Vestby Export] Also trying saveAs as parallel fallback');
      saveAs(generatedBlob, filename);
    } catch (saveError) {
      console.error('[Vestby Export] saveAs also failed:', saveError);
    }

    setDownloadComplete(true);
  };

  const handleExportTxt = () => {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = `reservekopi_${exportData.name.replace(/\s+/g, '-') || 'elev'}.txt`.toLowerCase();
    console.log('[Vestby Export] Starting TXT export:', filename, 'size:', blob.size);

    // Use data URI for Mac SEB compatibility
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      console.log('[Vestby Export] TXT data URI created');
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('[Vestby Export] TXT download link clicked');
    };
    reader.onerror = (e) => {
      console.error('[Vestby Export] TXT data URI failed:', e);
      // Fallback to saveAs if data URI fails
      try {
        saveAs(blob, filename);
        console.log('[Vestby Export] TXT saveAs fallback executed');
      } catch (saveError) {
        console.error('[Vestby Export] TXT saveAs also failed:', saveError);
      }
    };
    reader.readAsDataURL(blob);
  };

  const handleCloseExportModal = () => {
    setShowExportModal(false);
    setDownloadComplete(false);
    setGeneratedBlob(null);
    setExportError(null);
    if (downloadUrl) {
      // Note: revokeObjectURL is a no-op for data: URIs but safe to call
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  };



  if (!editor) return null;

  // Block duplicate tabs from interacting with the app
  if (isDuplicateTab) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-lg w-full text-center space-y-6">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800">
            Skriveprogrammet er allerede åpent
          </h1>
          <p className="text-gray-600 leading-relaxed">
            Lukk denne fanen og gå tilbake til det andre vinduet for å fortsette å skrive.
          </p>
          <p className="text-xs text-gray-400">
            Hvorfor? Fordi ellers funker ikke sikkerhetskopieringen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-arial h-screen overflow-hidden">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center shadow-sm shrink-0">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm whitespace-nowrap"
          >
            <Download size={18} />
            Lagre til Word (.docx)
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            <span className="text-gray-400 font-medium">Sikkerhetskopi</span>
            <div className="flex items-center">
              {isSaved ? (
                <div
                  className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.4)] transition-all duration-500"
                  title="Alt er lagret lokalt"
                />
              ) : (
                <div
                  className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_5px_rgba(251,191,36,0.4)] transition-all duration-500"
                  title="Lagrer endringer..."
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 justify-center">
          <div className="flex items-center gap-1 border-r pr-2 mr-2 border-gray-200">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn("p-2 rounded hover:bg-gray-100 transition-colors", editor.isActive('bold') && "bg-blue-100 text-blue-600")}
              title="Fet"
            >
              <Bold size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn("p-2 rounded hover:bg-gray-100 transition-colors", editor.isActive('italic') && "bg-blue-100 text-blue-600")}
              title="Kursiv"
            >
              <Italic size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={cn("p-2 rounded hover:bg-gray-100 transition-colors", editor.isActive('underline') && "bg-blue-100 text-blue-600")}
              title="Understrek"
            >
              <UnderlineIcon size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1 border-r pr-2 mr-2 border-gray-200">
            <select
              onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
              className="p-1 rounded border border-gray-200 text-sm outline-none bg-white"
              value={editor.getAttributes('textStyle').fontFamily || 'OpenDyslexic'}
            >
              <option value="OpenDyslexic">OpenDyslexic</option>
              <option value="Arial">Arial</option>
              <option value="Verdana">Verdana</option>
            </select>

            <select
              onChange={(e) => {
                const size = e.target.value;
                editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
              }}
              className="p-1 rounded border border-gray-200 text-sm outline-none bg-white"
              value={editor.getAttributes('textStyle').fontSize?.replace('px', '') || '14'}
            >
              {[12, 14, 16, 18, 20, 24, 30, 36].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 border-r pr-2 mr-2 border-gray-200">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded hover:bg-gray-100 transition-colors"
              title="Zoom ut"
            >
              <ZoomOut size={18} />
            </button>
            <div className="text-xs text-gray-400 w-10 text-center font-mono">
              {zoom}%
            </div>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded hover:bg-gray-100 transition-colors"
              title="Zoom inn"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1 border-r pr-2 mr-2 border-gray-200">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={cn("p-2 rounded hover:bg-gray-100 transition-colors", editor.isActive('bulletList') && "bg-blue-100 text-blue-600")}
              title="Punktliste"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={cn("p-2 rounded hover:bg-gray-100 transition-colors", editor.isActive('orderedList') && "bg-blue-100 text-blue-600")}
              title="Nummerert liste"
            >
              <ListOrdered size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-2 rounded hover:bg-gray-100 transition-colors disabled:opacity-30"
              title="Angre"
            >
              <Undo size={18} />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-2 rounded hover:bg-gray-100 transition-colors disabled:opacity-30"
              title="Gjør om"
            >
              <Redo size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex justify-end items-center gap-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={cn(
              "p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm font-medium",
              showSidebar ? "text-blue-600 bg-blue-50" : "text-gray-600"
            )}
            title="Grammatikk"
          >
            {spellcheckStatus === 'loading' ? (
              <Loader2 size={18} className="animate-spin text-blue-500" />
            ) : spellcheckStatus === 'error' ? (
              <AlertCircle size={18} className="text-red-500" />
            ) : (
              <Search size={18} />
            )}
            {filteredResults.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {filteredResults.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-[#f3f3f3] relative">
        {/* Editor Area */}
        <main className="flex-1 overflow-y-auto pt-8 pb-20 transition-all duration-300">
          <div
            className={cn(
              "transition-all duration-300 relative",
              showSidebar ? "ml-[calc(50%-105mm-160px)]" : "mx-auto"
            )}
            style={{
              width: '210mm',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            <div className="hidden md:block">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="page-label"
                  style={{ top: `${562 + (i * 1124) + 32}px` }}
                >
                  Side {i + 1}
                </div>
              ))}
            </div>
            <EditorContent editor={editor} />
          </div>
        </main>

        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 animate-in slide-in-from-right duration-300 absolute right-0 top-0 bottom-0 z-10 shadow-xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                Språkfeil
                {filteredResults.length > 0 && (
                  <span className="text-xs font-normal text-gray-500">
                    ({filteredResults.length})
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1 hover:bg-gray-200 rounded-md text-gray-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {spellcheckStatus === 'loading' || spellcheckStatus === 'idle' ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center space-y-4">
                  <Loader2 size={48} className="text-blue-100 animate-spin" />
                  <div className="space-y-1">
                    <p className="font-medium">Laster stavekontroll...</p>
                    <p className="text-xs">Dette tar bare noen sekunder.</p>
                  </div>
                </div>
              ) : spellcheckStatus === 'error' ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center space-y-4">
                  <AlertCircle size={48} className="text-red-100" />
                  <div className="space-y-1">
                    <p className="font-medium">Kunne ikke laste stavekontroll</p>
                    <p className="text-xs text-red-400">Prøv å laste siden på nytt.</p>
                  </div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center space-y-2">
                  <CheckCircle2 size={48} className="text-green-100" />
                  <p>Ingen feil funnet</p>
                </div>
              ) : (
                filteredResults.map((result, idx) => (
                  <div
                    key={idx}
                    data-error-key={`${result.span.start}-${result.span.end}`}
                    className={cn(
                      "group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-md transition-all bg-white cursor-pointer",
                      focusedErrorKey === `${result.span.start}-${result.span.end}` && "border-blue-500 ring-1 ring-blue-500 shadow-sm bg-blue-50/20"
                    )}
                    onClick={() => {
                      setFocusedErrorKey(`${result.span.start}-${result.span.end}`);
                      const start = getPos(result.span.start);
                      const end = getPos(result.span.end, true);
                      editor.chain().focus().setTextSelection({ from: start, to: end }).run();
                    }}
                  >
                    <div className="flex justify-between items-center p-3 bg-white group-hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-6 rounded-full",
                          result.category === 'Spelling' ? "bg-red-500" :
                            result.category === 'Typo' ? "bg-orange-500" :
                              result.category === 'Grammar' ? "bg-blue-500" :
                                result.category === 'Style' ? "bg-yellow-500" :
                                  result.category === 'WordChoice' ? "bg-green-500" :
                                    "bg-gray-400",
                          focusedErrorKey === `${result.span.start}-${result.span.end}` && "ring-2 ring-offset-1 ring-blue-400"
                        )} />
                        <span className="text-sm font-bold text-gray-700">
                          {result.category === 'Spelling' ? 'Stavefeil' :
                            result.category === 'Grammar' ? 'Grammatikk' :
                              result.category === 'Capitalization' ? 'Stor bokstav' :
                                result.category === 'Punctuation' ? 'Tegnsetting' :
                                  result.category === 'WordChoice' ? 'Ordvalg' :
                                    result.category === 'Style' ? 'Stil' :
                                      result.category === 'Typo' ? 'Skrivefeil' :
                                        result.category === 'Miscellaneous' ? 'Annet' :
                                          result.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const start = getPos(result.span.start);
                            const end = getPos(result.span.end, true);
                            setIgnoredSpans(prev => [...prev, {
                              start: result.span.start,
                              end: result.span.end,
                              text: editor.state.doc.textBetween(start, end)
                            }]);
                            // Return focus to editor after ignoring
                            setTimeout(() => editor.chain().focus().run(), 10);
                          }}
                          className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold uppercase tracking-wider hover:bg-red-100 transition-colors"
                        >
                          Ignorer
                        </button>
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-1">
                      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                        {simplifyMessage(result)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {result.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2 w-full">
                            {result.suggestions.slice(0, 3).map((suggestion, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const start = getPos(result.span.start);
                                  const end = getPos(result.span.end, true);
                                  editor.chain().focus().insertContentAt({ from: start, to: end }, suggestion).run();
                                  // Ensure focus is back in the editor after applying suggestion
                                  setTimeout(() => editor.chain().focus().run(), 10);
                                }}
                                className="flex-1 text-sm bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-all font-bold shadow-sm text-center"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 px-6 py-2 flex justify-between items-center text-sm text-gray-600 z-20">
        <div className="flex items-center gap-6">
          <div>
            Antall ord: <span className="font-bold">{wordCount}</span>
          </div>
          <div className="h-4 w-[1px] bg-gray-300" />
          <div className="flex items-center gap-2">
            <Search size={14} className={cn(spellcheckLang === 'off' && "opacity-50")} />
            <span className="font-medium text-gray-500">Stavekontroll:</span>
            <select
              value={spellcheckLang}
              onChange={(e) => setSpellcheckLang(e.target.value as SpellcheckLanguage)}
              className={cn(
                "px-2 py-1 rounded border border-gray-200 text-sm font-medium outline-none bg-white cursor-pointer",
                spellcheckLang !== 'off' ? "text-blue-600" : "text-gray-400"
              )}
            >
              <option value="en">Engelsk (internasjonal)</option>
              <option value="no">Norsk (Bokmål)</option>
              <option value="off">Av</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => setShowAboutModal(true)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          title="Om Vestby prøve"
        >
          <Info size={18} />
        </button>
      </footer>

      {/* Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleCloseExportModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Lagre besvarelse</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all lowercase"
                  placeholder="Ditt fulle navn"
                  value={exportData.name}
                  onChange={(e) => {
                    setExportData({ ...exportData, name: e.target.value.toLowerCase() });
                    setDownloadUrl(null);
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Klasse</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all lowercase"
                  placeholder="F.eks. 10A"
                  value={exportData.class}
                  onChange={(e) => {
                    setExportData({ ...exportData, class: e.target.value.toLowerCase() });
                    setDownloadUrl(null);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fag</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all lowercase"
                  placeholder="F.eks. Norsk"
                  value={exportData.subject}
                  onChange={(e) => {
                    setExportData({ ...exportData, subject: e.target.value.toLowerCase() });
                    setDownloadUrl(null);
                  }}
                />
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <div className="space-y-4">
                {/* Step 1: Prepare */}
                <div className="relative">
                  <button
                    onClick={handlePrepareExport}
                    disabled={!exportData.name || !exportData.class || !exportData.subject || isGenerating || !!downloadUrl}
                    className={cn(
                      "w-full px-4 py-4 rounded-lg transition-all font-medium flex items-center justify-center gap-2 border-2",
                      !downloadUrl
                        ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        : "bg-gray-50 border-gray-200 text-gray-400 cursor-default"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs border",
                      !downloadUrl ? "bg-white text-blue-600 border-white" : "bg-gray-200 text-gray-400 border-gray-300"
                    )}>
                      1
                    </div>
                    {isGenerating ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Gjør klar fil...
                      </>
                    ) : downloadUrl ? (
                      "Filen er klargjort"
                    ) : (
                      "Gjør klar Word-fil"
                    )}
                    {downloadUrl && <CheckCircle2 size={18} className="text-green-500 ml-auto" />}
                  </button>
                  {exportError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                      <AlertCircle size={16} />
                      {exportError}
                    </div>
                  )}
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center -my-2 relative z-10">
                  <div className={cn(
                    "bg-white p-1 rounded-full border transition-colors",
                    downloadUrl ? "text-green-500 border-green-200" : "text-gray-300 border-gray-100"
                  )}>
                    <ChevronDown size={20} />
                  </div>
                </div>

                {/* Step 2: Download */}
                <div className="relative">
                  {!downloadUrl ? (
                    <div className="w-full px-4 py-4 bg-gray-50 border-2 border-dashed border-gray-200 text-gray-400 rounded-lg font-medium flex items-center justify-center gap-2 opacity-60">
                      <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-400 border border-gray-300 flex items-center justify-center text-xs">
                        2
                      </div>
                      Last ned filen
                    </div>
                  ) : downloadComplete ? (
                    <div className="w-full px-4 py-6 bg-green-50 border-2 border-green-500 text-green-700 rounded-lg font-bold flex flex-col items-center justify-center gap-2 animate-in zoom-in duration-300">
                      <div className="flex items-center gap-2 text-xl">
                        <CheckCircle2 size={28} className="text-green-600" />
                        Filen er lagret!
                      </div>
                      <p className="text-sm font-normal text-green-600">
                        Filen ligger nå i din nedlastingsmappe.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <a
                        href={downloadUrl}
                        download={`${exportData.name.replace(/\s+/g, '-')}_${exportData.class.replace(/\s+/g, '-')}_${exportData.subject.replace(/\s+/g, '-')}.docx`.toLowerCase()}
                        onClick={() => {
                          console.log('[Vestby Export] Main download button clicked');
                          setDownloadComplete(true);
                        }}
                        className="w-full px-4 py-4 bg-green-600 border-2 border-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-bold shadow-lg flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300"
                      >
                        <div className="w-6 h-6 rounded-full bg-white text-green-600 flex items-center justify-center text-xs">
                          2
                        </div>
                        KLIKK HER FOR Å LAGRE
                        <Download size={20} className="ml-auto" />
                      </a>
                      {/* Fallback button for Mac SEB or other browsers where data URI fails */}
                      <button
                        onClick={handleFallbackDownload}
                        className="w-full text-center text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
                      >
                        Fungerer ikke? Klikk her for alternativ nedlasting
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleCloseExportModal}
                className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 transition-colors text-sm mt-2"
              >
                Avbryt
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={handleExportTxt}
                className="text-gray-300 hover:text-gray-500 transition-colors text-[10px] uppercase tracking-widest block mx-auto"
              >
                Last ned som enkel tekstfil (reservekopi)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Om Vestby prøve</h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Vestby prøve er et enkelt, sikkert og "dumt" skriveverktøy laget for elever under prøver og eksamen.
                Det er designet for å fungere perfekt i <strong>Safe Exam Browser (SEB)</strong>.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-2">GDPR og personvern</h3>
                <p className="text-sm text-blue-700">
                  Ingen tekst eller personopplysninger du skriver her forlater noen gang denne datamaskinen.
                  Innholdet lagres kun i nettleserens lokale minne (localStorage) for å sikre mot krasj eller tomt batteri.
                  Ingenting sendes til en server eller lagres i skyen.
                </p>
              </div>
              <p>
                <strong>Åpen kildekode:</strong> Prosjektet er åpent og gjennomsiktig. Kildekoden kan leses av alle på GitHub.
              </p>
              <p className="text-sm">
                Laget av en lærer for lærere. Lisensiert under MIT-lisensen.
              </p>
              <div className="pt-4 border-t flex justify-between items-center">
                <a
                  href="https://github.com/sigurdeye/Vestby-Prove"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  GitHub Repository
                </a>
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
                >
                  Lukk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
