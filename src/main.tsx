import React from "react";
import { ReactFlowProvider } from "reactflow";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";
import "antd/dist/reset.css";
import "reactflow/dist/style.css";
import "./css/variables.css";
import "./css/flowStyles.css";
import "./css/legend.css";
import "./css/App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </React.StrictMode>
);
