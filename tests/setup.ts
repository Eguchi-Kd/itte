import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// 画面は遅延読み込みなので、並列実行で重いときの初回の読み込みを待てるようにする
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
});
