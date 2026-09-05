"use client";

import dynamic from "next/dynamic";
import styles from "./map.module.css";

export const DynamicRiskMap = dynamic(() => import("./RiskMap"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading}>
      <div className={styles.mapSpinner} />
      <p>Initializing East Khasi Hills GIS Network...</p>
    </div>
  ),
});

export default DynamicRiskMap;
