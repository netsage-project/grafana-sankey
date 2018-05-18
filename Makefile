# (C) 2018 Tyson Seto-Mook, Laboratory for Advanced Visualization and Applications, University of Hawaii at Manoa.


# To chane plugin name
# 1) update FULL_NAME and SHORT_NAME 
# 2) run target change_name
# 3) if updating again, move new name to old name, then update new name
FULL_NAME = NetSage Sankey
SHORT_NAME = sankeynetsage
DOT_NAME = $(shell echo "$(FULL_NAME)" | tr ' ' '.')
NOSPACE_NAME = $(shell echo "$(FULL_NAME)" | tr -d ' ')
UNDERSCORE_NAME = $(shell echo "$(FULL_NAME)" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
NAME = $(shell echo "$(FULL_NAME)" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

PREV_FULL_NAME = NetSage Boilerplate
PREV_SHORT_NAME = boilerplate
PREV_DOT_NAME = $(shell echo "$(PREV_FULL_NAME)" | tr ' ' '.')
PREV_NOSPACE_NAME = $(shell echo "$(PREV_FULL_NAME)" | tr -d ' ')
PREV_UNDERSCORE_NAME = $(shell echo "$(PREV_FULL_NAME)" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
PREV_NAME = $(shell echo "$(PREV_FULL_NAME)" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
#NAME = netsage-boilerplate
VERSION = 1.0.2

FILES =
FILES += "gulpfile.js"
FILES += "package.json"
FILES += "plugin.json"
FILES += "src/editor.html"
FILES += "src/module.html"
FILES += "src/module.js"
FILES += "src/$(PREV_UNDERSCORE_NAME).js"
FILES += "src/css/$(PREV_SHORT_NAME).css"

reload:
		sudo systemctl stop grafana-server
		sleep 1
		sudo systemctl start grafana-server
build:
		npm install -g gulp
		npm install
		gulp
plugin: build
		#rm -rf netsage-boilerplate/
		mv dist/ $(NAME)/
install: plugin
		sudo rm -rf /var/lib/grafana/plugins/$(NAME)/
		sudo mv $(NAME)/ /var/lib/grafana/plugins/
		$(MAKE) reload
name_change:
		@#most likely requires vim to work properly
		@for f in $(FILES); do \
			ex -sc '%s/$(PREV_FULL_NAME)/$(FULL_NAME)/g|x' $$f; \
			echo "$$f  $(PREV_FULL_NAME) --> $(FULL_NAME)"; \
			ex -sc '%s/$(PREV_DOT_NAME)/$(DOT_NAME)/g|x' $$f; \
			echo "$$f  $(PREV_DOT_NAME) --> $(DOT_NAME)"; \
			ex -sc '%s/$(PREV_NOSPACE_NAME)/$(NOSPACE_NAME)/g|x' $$f; \
			echo "$$f  $(PREV_NOSPACE_NAME) --> $(NOSPACE_NAME)"; \
			ex -sc '%s/$(PREV_UNDERSCORE_NAME)/$(UNDERSCORE_NAME)/g|x' $$f; \
			echo "$$f  $(PREV_UNDERSCORE_NAME) --> $(UNDERSCORE_NAME)"; \
			ex -sc '%s/$(PREV_NAME)/$(NAME)/g|x' $$f; \
			echo "$$f  $(PREV_NAME) --> $(NAME)"; \
			ex -sc '%s/$(PREV_SHORT_NAME)/$(SHORT_NAME)/g|x' $$f; \
			echo "$$f  $(PREV_SHORT_NAME) --> $(SHORT_NAME)"; \
		done;
		mv "src/$(PREV_UNDERSCORE_NAME).js" "src/$(UNDERSCORE_NAME).js"

super_clean:
		rm -rf node_modules package-lock.json dist/ $(NAME)/
test:
	@echo $(FULL_NAME)
	@echo $(SHORT_NAME)
	@echo $(DOT_NAME)
	@echo $(NOSPACE_NAME)
	@echo $(UNDERSCORE_NAME)
	@echo $(NAME)
	@echo "-----------"
	@echo $(PREV_FULL_NAME)
	@echo $(PREV_SHORT_NAME)
	@echo $(PREV_DOT_NAME)
	@echo $(PREV_NOSPACE_NAME)
	@echo $(PREV_UNDERSCORE_NAME)
	@echo $(PREV_NAME)

