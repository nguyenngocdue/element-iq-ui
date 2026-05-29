const fs = require('fs');

const replaceInFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/#007acc/g, '#10b981');
  content = content.replace(/#0062a3/g, '#059669');
  content = content.replace(/#006bb3/g, '#059669');
  fs.writeFileSync(file, content);
};

['src/components/BottomBar.tsx', 'src/components/Sidebar.tsx', 'src/components/AnalysisDashboard.tsx', 'src/components/AnalysisView.tsx', 'src/components/MainEditor.tsx', 'src/components/TopBar.tsx', 'src/components/ComponentCard.tsx', 'src/components/ImportModal.tsx', 'src/components/ProjectDashboard.tsx', 'src/index.css'].forEach(replaceInFile);
