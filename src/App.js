import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Mic, Send, Volume2, Copy, Check, Settings, X, ArrowDown, KeyRound } from 'lucide-react';

// --- Main App Component ---
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ voiceOutput: true });
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(true);
  const [tempApiKey, setTempApiKey] = useState('');

  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    // Theme management from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    const savedApiKey = localStorage.getItem('rugved_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setShowApiModal(false);
    }
  }, []);

  useEffect(() => {
    // Apply theme to HTML element
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Auto-resize textarea based on content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    // Scroll to the bottom of the chat container when new messages arrive
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Setup Web Speech API for voice input
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);
  
  useEffect(() => {
    // Show/hide the "scroll to bottom" button
    const handleScroll = () => {
        if (chatContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            setShowScrollDown(scrollHeight - scrollTop > clientHeight + 150);
        }
    };
    const chatContainer = chatContainerRef.current;
    chatContainer?.addEventListener('scroll', handleScroll);
    return () => chatContainer?.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Functions ---
  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  };
  
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    if (tempApiKey) {
      setApiKey(tempApiKey);
      localStorage.setItem('rugved_api_key', tempApiKey);
      setShowApiModal(false);
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === '' || isTyping) return;

    const userMessage = { text: input, sender: 'user', id: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
        const chatHistory = newMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
        // The last message is the user's current input, so we don't need to add it again.

        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        let aiResponseText = '';

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            aiResponseText = result.candidates[0].content.parts[0].text;
        } else {
            aiResponseText = "I'm sorry, I couldn't generate a response. Please try again.";
        }
        
        const aiMessage = { text: aiResponseText, sender: 'ai', id: Date.now() + 1 };
        setMessages(prev => [...prev, aiMessage]);
        
        if (settings.voiceOutput) {
            speak(aiResponseText.trim());
        }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { text: `Sorry, something went wrong: ${error.message}`, sender: 'ai', error: true, id: Date.now() + 1 };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  };

  const speak = (text) => {
    if ('speechSynthesis' in window && text) {
      const utterance = new SpeechSynthesisUtterance(text);
      speechSynthesis.cancel(); // Cancel any previous speech
      speechSynthesis.speak(utterance);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleSettingsChange = (setting) => {
    setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
  };

  // --- Render ---
  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      {/* --- API Key Modal --- */}
       <AnimatePresence>
        {showApiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md"
            >
              <form onSubmit={handleApiKeySubmit}>
                <h2 className="text-xl font-bold mb-4 text-center">Login Credentials</h2>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">Please enter your credentials to continue.</p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Enter your credentials here"
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button type="submit" className="w-full mt-6 bg-blue-500 text-white rounded-lg p-2 font-bold hover:bg-blue-600 transition-colors">
                  Login
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Main Chat Area --- */}
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-gray-700">
          <h1 className="text-xl font-bold">Rugved AI</h1>
          <div className="flex items-center space-x-2">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative">
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
          {isTyping && <TypingIndicator />}
          {showScrollDown && (
            <button onClick={scrollToBottom} className="absolute bottom-20 right-8 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-10">
                <ArrowDown size={24} />
            </button>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-gray-300 dark:border-gray-700">
          <div className="relative bg-gray-200 dark:bg-gray-800 rounded-xl flex items-end p-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-base mx-2 max-h-48"
            />
            <button onClick={handleMicClick} className={`p-2 rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
              <Mic size={20} />
            </button>
            <button onClick={handleSendMessage} disabled={isTyping || !input.trim()} className="p-2 rounded-full bg-blue-500 text-white ml-2 hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* --- Settings Modal --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Voice Output (Text-to-Speech)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.voiceOutput} onChange={() => handleSettingsChange('voiceOutput')} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---
const MessageBubble = ({ message }) => {
  const { text, sender, error } = message;
  const isUser = sender === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if(text) {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window && text) {
      const utterance = new SpeechSynthesisUtterance(text);
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
          R
        </div>
      )}
      <div className={`max-w-xl p-3 rounded-xl ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'} ${error ? 'bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300' : ''}`}>
        <p className="whitespace-pre-wrap">{text || "..."}</p>
        {!isUser && text && !error && (
          <div className="flex items-center gap-2 mt-2 text-gray-500 dark:text-gray-400">
            <button onClick={handleCopy} className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
            <button onClick={handleSpeak} className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
              <Volume2 size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3"
  >
    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
        R
    </div>
    <div className="flex items-center space-x-1 p-3 bg-gray-200 dark:bg-gray-700 rounded-xl">
      <motion.div
        className="w-2 h-2 bg-gray-500 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="w-2 h-2 bg-gray-500 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-gray-500 rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  </motion.div>
);
