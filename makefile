fmt:
	npx prettier --write app/static/*
	black app
	flake8 app

run:
	python app/app.py

build:
	curl https://install.duckdb.org | sh
	make build_rome

build_rome:
	curl https://dati.comune.roma.it/catalog/dataset/a7dadb4a-66ae-4eff-8ded-a102064702ba/resource/266d82e1-ba53-4510-8a81-370880c4678f/download/rome_static_gtfs_test.zip --output ./datasets/rome/rome_static_gtfs_test.zip
	unzip -o rome_static_gtfs_test.zip
	duckdb ../mydata.duckdb  -c ".read import_rome.sql"
	
