'use client';

/** Auto Detect section — microphone listening + live transcript + activity feed. */
export default function AutoDetectSection() {
  return (
    <div id="dndAutoDetect" className="app-section hidden">
      <div className="section-header">
        <h2>Auto Detect</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">
          SoundGoblin will listen and automatically play contextual sounds and music.
        </p>

        {/* Scene Presets Bar — populated by SoundGoblin engine */}
        <div className="scene-presets-bar" id="scenePresetsBar" />

        <div className="context-input-area">
          <label htmlFor="dndContextInput">Story Context (Optional)</label>
          <textarea
            id="dndContextInput"
            rows="4"
            placeholder="Example: 'A dark medieval dungeon crawl beneath a cursed castle' or 'A tavern scene in a bustling port city'"
          />
          <p className="info-text">
            Describe the setting, genre, or mood to help the AI choose better sounds.
          </p>
        </div>

        {/* Session Stats */}
        <section className="session-stats" id="sessionStats">
          <div className="stat-item">
            <span className="stat-value" id="statSounds">0</span>
            <span className="stat-label">Sounds</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statTriggers">0</span>
            <span className="stat-label">Triggers</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statTransitions">0</span>
            <span className="stat-label">Music</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statKeywords">0</span>
            <span className="stat-label">Keywords</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statAnalyses">0</span>
            <span className="stat-label">AI Calls</span>
          </div>
        </section>

        {/* Audio Visualizer */}
        <section className="visualizer-section" id="visualizerSection">
          <canvas id="visualizer" />
          <div className="status-row">
            <span className="mic-indicator" id="micIndicator" />
            <div id="statusText" className="status-text">Ready to listen...</div>
          </div>
        </section>

        {/* Control Buttons */}
        <section className="controls">
          <button id="testMicBtn" className="btn-test">Test Microphone</button>
          <button id="startBtn" className="btn-start">Start Listening</button>
          <button id="stopBtn" className="btn-stop hidden">Stop Listening</button>
          <button id="stopAudioBtn" className="btn-stop-audio">Stop Audio</button>
        </section>

        {/* Mute Categories */}
        <section className="mute-categories">
          <button className="mute-cat-btn active" data-cat="music">Music</button>
          <button className="mute-cat-btn active" data-cat="sfx">SFX</button>
          <button className="mute-cat-btn active" data-cat="ambience">Ambience</button>
        </section>

        {/* Live Transcript */}
        <section className="transcript-section">
          <h3>What I&apos;m Hearing</h3>
          <div id="transcript" className="transcript-box">Waiting for audio input...</div>
        </section>

        {/* Currently Playing */}
        <section className="sounds-section">
          <h3>Currently Playing</h3>
          <div id="currentSounds" className="sounds-list">
            <div className="sound-item inactive">No sounds playing</div>
          </div>
        </section>

        {/* AI Activity Feed */}
        <section className="activity-feed-section">
          <h3 id="activityFeedToggle">
            AI Activity <span className="toggle-indicator">&#9660;</span>
          </h3>
          <div id="activityLog" className="activity-log" />
        </section>
      </div>
    </div>
  );
}
