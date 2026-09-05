import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.hero}>
      <div className={styles.heroBackground} />

      <div className={styles.heroContent}>
        <div className={styles.badge}>
          <span>🏔️</span> Built for India&apos;s North Eastern Region
        </div>

        <h1 className={styles.title}>
          <span className={styles.titleAccent}>Setu</span>
          <br />
          Smart Logistics &<br />
          Accessibility Platform
        </h1>

        <p className={styles.subtitle}>
          AI-powered road risk monitoring, safe routing, and real-time hazard
          reporting for NER&apos;s most critical transport corridors. Keeping
          medicine, food, and essential goods moving — even when the terrain
          fights back.
        </p>

        <div className={styles.ctas}>
          <a href="/signup" className="btn btn-primary btn-lg">
            Get Started →
          </a>
          <a href="/login" className="btn btn-secondary btn-lg">
            Log In
          </a>
        </div>

        {/* Feature highlights */}
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🗺️</div>
            <h3>Live Risk Map</h3>
            <p>Real-time road risk visualization with color-coded segments across East Khasi Hills</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🛤️</div>
            <h3>AI Safe Routing</h3>
            <p>Dijkstra-based pathfinding that avoids high-risk segments — not just shortest distance</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📋</div>
            <h3>Field Reporting</h3>
            <p>Report landslides, floods, and road damage with end-to-end encrypted payloads</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📡</div>
            <h3>Offline-First</h3>
            <p>Reports queue locally when offline and auto-sync when connectivity returns. SMS fallback included.</p>
          </div>
        </div>

        <div className={styles.footer}>
          <p>
            Ministry of Development of North Eastern Region (MDoNER) • SIH26002
          </p>
        </div>
      </div>
    </main>
  );
}
