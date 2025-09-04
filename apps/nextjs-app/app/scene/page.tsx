"use client";

import React, { useEffect } from "react";
import { SceneProvider, DomLayer, DomNode, useScene } from "corlena/react";

function DemoNode() {
  const id = 1;
  const { ready, upsertNode, getTransform } = useScene();

  useEffect(() => {
    console.log("Scene ready:", ready);
    if (ready) {
      // Manually ensure the node is registered
      upsertNode({ id, x: 70, y: 45, w: 140, h: 90 });
      console.log("Upserted node:", id);
      
      // Check if we can get transforms
      const interval = setInterval(() => {
        const transform = getTransform(id);
        if (transform) {
          console.log("Transform for node", id, ":", transform);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [ready, upsertNode, getTransform, id]);

  return (
    <DomNode
      id={id}
      style={{
        width: 140,
        height: 90,
        background: ready ? "#2a2a2a" : "#444",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        borderRadius: 10,
        boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
      }}
      onTap={(nodeId) => console.log("Tapped node:", nodeId)}
      onDragStart={(nodeId) => console.log("Drag start:", nodeId)}
      onDragEnd={(nodeId) => console.log("Drag end:", nodeId)}
    >
      Node {id} {ready ? "✓" : "⏳"}
    </DomNode>
  );
}

export default function ScenePage() {
  return (
    <main style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 12 }}>Corlena React Scene</h1>
      <p style={{ marginBottom: 12, color: "#777" }}>
        Drag within the node. This page uses SceneProvider + DomLayer + DomNode.
      </p>
      <div
        style={{
          width: "min(420px, 100%)",
          aspectRatio: "9 / 16",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          position: "relative",
        }}
      >
        <SceneProvider tapParams={[0.1, 2.0, 0.3, 0.05]} capacity={256}>
          <DomLayer>
            <DemoNode />
          </DomLayer>
        </SceneProvider>
      </div>
      <nav style={{ marginTop: 16 }}>
        <a href="/">Home</a>
      </nav>
    </main>
  );
}
