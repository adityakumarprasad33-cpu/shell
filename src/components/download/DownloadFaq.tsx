'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

export function DownloadFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Does Runix Terminal require an active internet connection?',
      a: 'No. Runix Terminal operates locally by default, allowing you to edit files, compile, and execute local terminal commands offline. Cloud workspace synchronization and remote sandboxes activate automatically when connectivity is present.',
    },
    {
      q: 'How does workspace file synchronization work with the cloud?',
      a: 'Runix Terminal uses a zero-trust encrypted synchronization layer. When you run commands in cloud sandboxes or on other devices, your workspace state is synchronized incrementally with conflict-free replication.',
    },
    {
      q: 'Can I use my existing shell configurations (.zshrc, .bashrc, PowerShell profile)?',
      a: 'Yes. On desktop platforms (Windows, macOS, Linux), Runix Terminal inherits your default user environment variables and shell preferences. You can customize shells, font rendering, keybindings, and themes in the terminal configuration settings.',
    },
    {
      q: 'How are updates distributed to installed clients?',
      a: 'Desktop clients include background update checking against the official console.runix.in release feed. When a new stable version is published, Runix Terminal displays a notification with release notes and 1-click update verification.',
    },
    {
      q: 'Is Runix Terminal free for developers?',
      a: 'Yes. Runix Terminal is freely available for individual developers, open-source contributors, and development teams across all supported platforms.',
    },
  ];

  return (
    <section className="mb-14">
      <div className="mb-6">
        <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
          Questions & Answers
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-2xl bg-[#0E1117] border border-white/10 overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-semibold text-sm sm:text-base text-white tracking-tight">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans border-t border-white/5">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
