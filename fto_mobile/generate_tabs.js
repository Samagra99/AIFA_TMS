const fs = require('fs');
const path = require('path');

const write = (p, content) => {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, content);
};

const screens = ['dashboard', 'roster', 'dispatch', 'fleet', 'syllabus', 'schedule', 'logbook', 'more'];
const appDir = 'e:/AIFA/AIFA_TMS/fto_mobile/src/app';

screens.forEach(s => {
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  write(path.join(appDir, '(app)', '(tabs)', s + '.tsx'), `import { View, Text } from 'react-native';
import { useAuthStore } from '../../../stores/authStore';

export default function ${cap}Screen() {
  const role = useAuthStore((state) => state.user?.role) || 'Guest';
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24 }}>${cap}</Text>
      <Text>Logged in as: {role}</Text>
    </View>
  );
}
`);
});
