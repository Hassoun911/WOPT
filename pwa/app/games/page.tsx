"use client";

import { useMemo, useState } from "react";

const QUESTIONS = [
  { q: "How many daily obligatory prayers are there?", options: ["3", "4", "5", "6"], answer: 2 },
  { q: "Which surah is the first chapter of the Qur’an?", options: ["Al-Baqarah", "Al-Fatihah", "Yasin", "Al-Ikhlas"], answer: 1 },
  { q: "What direction do Muslims face for salah?", options: ["Madinah", "Jerusalem", "The Kaaba", "East"], answer: 2 },
  { q: "Which month is the month of fasting?", options: ["Muharram", "Rajab", "Ramadan", "Shawwal"], answer: 2 },
  { q: "What is the Friday congregational prayer called?", options: ["Tarawih", "Jumu’ah", "Witr", "Tahajjud"], answer: 1 },
  { q: "Which prayer comes immediately after Maghrib?", options: ["Fajr", "Dhuhr", "Asr", "Isha"], answer: 3 },
  { q: "How many surahs are in the Qur’an?", options: ["99", "100", "114", "120"], answer: 2 },
  { q: "What is zakat?", options: ["Pilgrimage", "Obligatory charity", "Fasting", "Call to prayer"], answer: 1 },
  { q: "Which city contains the Kaaba?", options: ["Makkah", "Madinah", "Cairo", "Damascus"], answer: 0 },
  { q: "What does 'Bismillah' begin with?", options: ["Praise", "In the name of Allah", "Peace", "Forgiveness"], answer: 1 },
];

export default function GamesPage(){
  const [index,setIndex]=useState(0); const [score,setScore]=useState(0); const [selected,setSelected]=useState<number|null>(null); const [done,setDone]=useState(false);
  const question=QUESTIONS[index];
  const best=useMemo(()=>typeof window!=="undefined"?Number(localStorage.getItem("hassoun-web-quiz-best")||0):0,[done]);
  function choose(i:number){if(selected!==null)return;setSelected(i);if(i===question.answer)setScore(s=>s+1);}
  function next(){if(index===QUESTIONS.length-1){const finalScore=score+(selected===question.answer?0:0);const latest=Math.max(best,finalScore);localStorage.setItem("hassoun-web-quiz-best",String(latest));setDone(true);return;}setIndex(i=>i+1);setSelected(null);}
  function restart(){setIndex(0);setScore(0);setSelected(null);setDone(false);}
  if(done)return <main className="parity-page"><section className="parity-hero"><div><div className="eyebrow">ISLAMIC GAMES</div><h1>Quiz complete</h1><p>Keep learning and improving your score.</p></div><div className="hero-badge">🏆</div></section><section className="quiz-card result"><div className="result-score">{score}/{QUESTIONS.length}</div><p>Best score: {Math.max(best,score)}/{QUESTIONS.length}</p><button className="primary-action" onClick={restart}>Play again</button></section></main>;
  return <main className="parity-page"><section className="parity-hero"><div><div className="eyebrow">ISLAMIC GAMES</div><h1>Quick Quiz</h1><p>Browser version of Hassoun’s Islamic learning games with saved best score.</p></div><div className="hero-badge">🎮</div></section><section className="quiz-card"><div className="quiz-progress"><span>Question {index+1} of {QUESTIONS.length}</span><span>Score {score}</span></div><h2>{question.q}</h2><div className="quiz-options">{question.options.map((option,i)=>{const cls=selected===null?"":i===question.answer?"correct":i===selected?"wrong":"";return <button key={option} className={cls} onClick={()=>choose(i)}>{option}</button>})}</div>{selected!==null?<button className="primary-action" onClick={next}>{index===QUESTIONS.length-1?"Finish":"Next question"}</button>:null}</section></main>;
}
