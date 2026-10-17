cd ~/OneDrive/Desktop/EMLH/certwinx
chmod +x fix.sh
./fix.sh
npm run build	
git add .
git status          # .env.local nahi dikhni chahiye
git commit -m "Shared sender pool + mobile fix v2"
git push