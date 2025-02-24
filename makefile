fmt:
	npx prettier --write app/static/*
	black app
	flake8 app

run:
	python app/app.py