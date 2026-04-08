param([string]$msg)

git add .
git commit -m "$msg"
git push
git checkout main
git pull
git merge work
git push
git checkout work