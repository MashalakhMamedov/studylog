# StudyLog

A Hevy-style study tracker for engineering students.

Most study apps track time generically. StudyLog tracks at the resource level — which PDF, which pages, which video, for how long, at what energy level. Built by an MSc Mechatronics Engineering student at Tor Vergata University (Rome) for managing multiple courses simultaneously.

🔗 Live app: https://studylog-pink.vercel.app

---

## What makes it different

Every other study timer (Athenify, Forest, Study-Track) tracks "I studied for 45 minutes." StudyLog tracks "I studied pages 45–62 of Structural Analysis, Deep Focus, High energy, Tuesday night."

- Track sessions at the resource level (specific PDF, textbook, video)
- Log which pages or sections you covered
- Mid-session course/resource swapping without stopping the timer
- Energy level and focus type per session
- Streak tracking and weekly activity view
- Per-course progress with "left off at" bookmarks

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React (JSX) |
| Backend / DB | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel |
| Styling | Tailwind CSS |

---

## Features

- Email/password authentication
- Course management with emoji, color, priority, exam date
- Resource management (PDF, Video, Textbook, Slides, Problem Set, etc.)
- Manual session logging with duration, pages, focus type, energy level
- Focus timer with Pomodoro mode, pause/resume, mid-session swap
- Dashboard with today/week stats, streak counter, activity chart
- Session history with editing and deletion
- Mobile-first dark theme

---

## Status

v2.0.0 — Stable. In active personal use.

---

## Background

Built as both a personal productivity tool and a portfolio project during my MSc in Mechatronics Engineering & ICT. The goal was something I would actually use myself — granular enough to know exactly where I left off in every resource across every course.
