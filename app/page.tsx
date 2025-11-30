'use client';

import React, { useEffect, useRef, useState } from 'react';

function App() {
  const workerRef = useRef<Worker | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // 主线程加载
    const worker = new Worker('/engine/stockfish-17.1-8e4d048.js');
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = event.data;
      console.log('Stockfish:', message);
      setLogs((prev) => [...prev.slice(-10), message]);
    };

    // 1. 启动
    worker.postMessage('uci');

    // 2. 开启内置 NNUE (不需要外部文件)
    setTimeout(() => {
      console.log('开启内置 NNUE...');
      worker.postMessage('setoption name Use NNUE value true');
      worker.postMessage('isready');
    }, 500);

    // 3. 跑一下看看
    setTimeout(() => {
      worker.postMessage('position startpos');
      worker.postMessage('go depth 15');
    }, 1000);

    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Stockfish 17.1 (最终修复版)</h1>
      <div style={{ background: '#f0f0f0', padding: 10, borderRadius: 5, fontFamily: 'monospace' }}>
        <h3>引擎日志:</h3>
        {logs.map((log, i) => (
          <div key={i} style={{ borderBottom: '1px solid #ddd' }}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default App;


// 'use client';

// import React, { useEffect, useRef, useState } from 'react';

// function App() {
//   const workerRef = useRef<Worker | null>(null);
//   const [logs, setLogs] = useState<string[]>([]);

//   useEffect(() => {
//     // 1. 指向你截图里的那个具体文件
//     // 注意：public 目录在浏览器中对应根路径，所以是 /engine/...
//     const worker = new Worker('/engine/stockfish-17.1-8e4d048.js');
//     workerRef.current = worker;

//     worker.onmessage = (event) => {
//       const message = event.data;
//       console.log('Stockfish:', message);
//       setLogs((prev) => [...prev.slice(-10), message]); // 只保留最后10行日志
//     };

//     // 2. 启动引擎
//     worker.postMessage('uci');

//     // setTimeout(() => {
//     //   console.log('正在加载 NNUE...');
//     //   worker.postMessage('setoption name EvalFile value /engine/nn-46832cfbead3.nnue');
//     //   worker.postMessage('setoption name Use NNUE value true');
//     // }, 500);

//     // 4. 测试计算
//     setTimeout(() => {
//       console.log('发送计算指令...');
//       worker.postMessage('isready');
//       worker.postMessage('position startpos');
//       worker.postMessage('go depth 15');
//     }, 1000);

//     return () => {
//       worker.terminate();
//     };
//   }, []);

//   return (
//     <div style={{ padding: 20 }}>
//       <h1>Stockfish 17.1 本地运行测试</h1>
//       <div style={{ background: '#f0f0f0', padding: 10, borderRadius: 5, fontFamily: 'monospace' }}>
//         <h3>引擎日志 (看这里动没动):</h3>
//         {logs.map((log, i) => (
//           <div key={i} style={{ borderBottom: '1px solid #ddd' }}>{log}</div>
//         ))}
//       </div>
//     </div>
//   );
// }

// export default App;
