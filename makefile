fmt:
	npx prettier --write app/static/app.js
	black app
	flake8 app

run:
	python app/app.py