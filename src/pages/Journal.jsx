import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/*
  Required Supabase table — run in SQL editor:

  create table journal_entries (
    id               uuid default gen_random_uuid() primary key,
    date             date not null unique,
    emotion_tags     text[] default '{}',
    setup_tags       text[] default '{}',
    went_well        text default '',
    went_wrong       text default '',
    rule_tomorrow    text default '',
    created_at       timestamptz default now()
  );
  alter table journal_entries enable row level security;
  create policy "allow all" on journal_entries for all using (true) with check (true);
*/

const EMOTION_TAGS = ['Calm', 'Focused', 'Anxious', 'Frustrated', 'Overconfident', 'Tired', 'Sharp', 'Hesitant'];
const SETUP_TAGS   = ['Trend', 'Counter-trend', 'Breakout', 'Retest', 'Range', 'Reversal', 'Scalp', 'News'];

const TODAY = new Date().toISOString().slice(0, 10);

function Card({ children, style }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '20px 22px', ...style }}>{children}</div>;
}

function TagToggle({ tag, active, onToggle }) {
  return (
    <button
      onClick={() => onToggle(tag)}
      style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--bdr)'}`, background: active ? 'var(--accent-muted)' : 'transparent', color: active ? 'var(--accent)' : 'var(--t2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
    >
      {tag}
    </button>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ background: 'var(--surface2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: '10px 12px', color: 'var(--t1)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={(e)  => (e.target.style.borderColor = 'var(--bdr)')}
      />
    </div>
  );
}

export default function Journal() {
  const [date, setDate]               = useState(TODAY);
  const [emotionTags, setEmotionTags] = useState([]);
  const [setupTags, setSetupTags]     = useState([]);
  const [wentWell, setWentWell]       = useState('');
  const [wentWrong, setWentWrong]     = useState('');
  const [ruleTomorrow, setRuleTomorrow] = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveErr, setSaveErr]         = useState(null);
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tableErr, setTableErr]       = useState(false);

  // Load entries
  useEffect(() => {
    supabase.from('journal_entries').select('*').order('date', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (error) { if (error.code === '42P01') setTableErr(true); setLoading(false); return; }
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [saved]);

  // Load entry for selected date
  useEffect(() => {
    const entry = entries.find((e) => e.date === date);
    if (entry) {
      setEmotionTags(entry.emotion_tags ?? []);
      setSetupTags(entry.setup_tags ?? []);
      setWentWell(entry.went_well ?? '');
      setWentWrong(entry.went_wrong ?? '');
      setRuleTomorrow(entry.rule_tomorrow ?? '');
    } else {
      setEmotionTags([]); setSetupTags([]); setWentWell(''); setWentWrong(''); setRuleTomorrow('');
    }
  }, [date, entries]);

  const toggleTag = (setter) => (tag) => setter((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSave = async () => {
    setSaving(true); setSaveErr(null); setSaved(false);
    const payload = { date, emotion_tags: emotionTags, setup_tags: setupTags, went_well: wentWell, went_wrong: wentWrong, rule_tomorrow: ruleTomorrow };
    const { error } = await supabase.from('journal_entries').upsert(payload, { onConflict: 'date' });
    if (error) { setSaveErr(error.message); } else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  };

  if (tableErr) return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <Card style={{ borderColor: 'var(--warn)', background: 'var(--warn-muted)' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--warn)' }}>Journal table not found</p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--t2)' }}>Run this SQL in your Supabase SQL editor to create the journal table:</p>
        <pre style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 6, padding: 12, fontSize: 11, color: 'var(--t1)', overflow: 'auto', margin: 0 }}>{`create table journal_entries (
  id            uuid default gen_random_uuid() primary key,
  date          date not null unique,
  emotion_tags  text[] default '{}',
  setup_tags    text[] default '{}',
  went_well     text default '',
  went_wrong    text default '',
  rule_tomorrow text default '',
  created_at    timestamptz default now()
);
alter table journal_entries enable row level security;
create policy "allow all" on journal_entries for all using (true) with check (true);`}</pre>
      </Card>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Date selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 7, padding: '8px 12px', color: 'var(--t1)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
        />
        {date === TODAY && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Today</span>}
      </div>

      {/* Tags row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>How did you feel?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {EMOTION_TAGS.map((t) => <TagToggle key={t} tag={t} active={emotionTags.includes(t)} onToggle={toggleTag(setEmotionTags)} />)}
          </div>
        </Card>
        <Card>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>What setups did you trade?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {SETUP_TAGS.map((t) => <TagToggle key={t} tag={t} active={setupTags.includes(t)} onToggle={toggleTag(setSetupTags)} />)}
          </div>
        </Card>
      </div>

      {/* Text areas */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TextArea label="What went well" value={wentWell} onChange={setWentWell} placeholder="Trades I executed well, rules I followed…" />
        <TextArea label="What went wrong" value={wentWrong} onChange={setWentWrong} placeholder="Mistakes, impulse trades, rule breaks…" />
        <TextArea label="Rule for tomorrow" value={ruleTomorrow} onChange={setRuleTomorrow} placeholder="One specific rule or intention for tomorrow's session…" rows={2} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button
            onClick={handleSave} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 7, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save entry'}
          </button>
          {saved    && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Saved</span>}
          {saveErr  && <span style={{ fontSize: 12, color: 'var(--loss)' }}>{saveErr}</span>}
        </div>
      </Card>

      {/* Previous entries */}
      {!loading && entries.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Previous Entries</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.slice(0, 10).map((e) => (
              <Card key={e.id} style={{ padding: '12px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => setDate(e.date)}
                onMouseEnter={(el) => (el.currentTarget.style.borderColor = 'var(--bdr2)')}
                onMouseLeave={(el) => (el.currentTarget.style.borderColor = 'var(--bdr)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 600, color: e.date === date ? 'var(--accent)' : 'var(--t1)' }}>
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {e.went_well && <p style={{ margin: 0, fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{e.went_well}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(e.emotion_tags ?? []).slice(0, 3).map((t) => (
                      <span key={t} style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--bdr)', fontSize: 10, color: 'var(--t2)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
