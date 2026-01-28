import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import History from '@tiptap/extension-history';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  List, ListOrdered, 
  Undo, Redo, Download, Info, CheckCircle2, AlertCircle,
  ZoomIn, ZoomOut, Search
} from 'lucide-react';
import { Document, Packer, Paragraph as DocxParagraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const [isSaved, setIsSaved] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [exportData, setExportData] = useState({ name: '', class: '', subject: '' });
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: {
          depth: 500,
        },
        heading: false,
        // We remove Underline from StarterKit to avoid duplication
        // since we are adding it manually below to ensure it works correctly
        underline: false,
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Underline,
      Typography,
    ],
    content: localStorage.getItem('vestby-prove-content') || '<p></p>',
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      localStorage.setItem('vestby-prove-content', content);
      
      // Word count
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      
      // Auto-save indicator
      setIsSaved(false);
      const timeout = setTimeout(() => setIsSaved(true), 1000);
      return () => clearTimeout(timeout);
    },
    onCreate: ({ editor }) => {
      // Set default font and size on creation if no content exists
      if (!localStorage.getItem('vestby-prove-content')) {
        editor.chain().focus().setFontFamily('OpenDyslexic').setMark('textStyle', { fontSize: '14px' }).run();
      }
    },
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class: 'font-opendyslexic', // Force default font class on the editor container
      },
    },
  });

  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setIsSaved(true);
    }
  }, [editor]);

  const handleExport = async () => {
    if (!editor) return;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: editor.getJSON().content?.map((node: any) => {
            let alignment = AlignmentType.LEFT;
            
            // Standard academic default for Word is 14pt (28 half-points)
            // Anything else is treated as a specific override
            const baseFontSize = 14;

            return new DocxParagraph({
              alignment,
              spacing: { 
                line: 360, // 1.5 line spacing
                before: 0,
                after: 120 
              },
              children: node.content?.map((child: any) => {
                // Tiptap might store fontSize in different places depending on the node structure
                let markSize = child.marks?.find((m: any) => m.type === 'fontSize')?.attrs?.fontSize;
                
                // Fallback: check if it's in a generic textStyle mark
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
              }) || [new TextRun({ text: "", size: baseFontSize * 2 })],
            });
          }) || [],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `${exportData.name.replace(/\s+/g, '-')}_${exportData.class.replace(/\s+/g, '-')}_${exportData.subject.replace(/\s+/g, '-')}.docx`;
    saveAs(blob, filename || 'vestby-prove.docx');
    setShowExportModal(false);
  };

  if (!editor) return null;

  return (
    <div className="min-h-screen flex flex-col font-arial">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center shadow-sm">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm whitespace-nowrap"
          >
            <Download size={18} />
            Lagre som .docx
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {isSaved ? (
              <><CheckCircle2 size={14} className="text-green-500" /> Lagret</>
            ) : (
              <><AlertCircle size={14} className="text-amber-500" /> Lagrer...</>
            )}
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
            {/* Heading buttons removed */}
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
          {/* Status moved to the left side next to the save button */}
        </div>
      </div>

      {/* Editor Area */}
      <main className="flex-1 bg-[#f3f3f3]">
        <div 
          className="transition-all duration-200 relative mx-auto"
          style={{ 
            width: '210mm', // Force the container to be the same width as the paper
            transform: `scale(${zoom / 100})`, 
            transformOrigin: 'top center',
          }}
        >
          {/* Page Labels (Side 1 to 10) */}
          <div className="hidden md:block">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="page-label" 
                style={{ top: `${562 + (i * 1124) + 32}px` }} // 32px is the top margin (2rem)
              >
                Side {i + 1}
              </div>
            ))}
          </div>
          <EditorContent editor={editor} />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 px-6 py-2 flex justify-between items-center text-sm text-gray-600">
        <div>
          Antall ord: <span className="font-bold">{wordCount}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Last ned dokument</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Ditt fulle navn"
                  value={exportData.name}
                  onChange={(e) => setExportData({ ...exportData, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Klasse</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="F.eks. 10A"
                  value={exportData.class}
                  onChange={(e) => setExportData({ ...exportData, class: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fag</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="F.eks. Norsk"
                  value={exportData.subject}
                  onChange={(e) => setExportData({ ...exportData, subject: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={handleExport}
                disabled={!exportData.name || !exportData.class || !exportData.subject}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last ned
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
