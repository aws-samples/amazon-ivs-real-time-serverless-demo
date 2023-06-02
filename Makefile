.DEFAULT_GOAL := help

.PHONY: help app install bootstrap synth deploy destroy clean

# Available ENV variables
#
# - AWS_PROFILE: named AWS CLI profile used to deploy
#								 default: none - default profile is used
#
# - STACK: stack name
#					 default: IVSRealTimeDemo
#
# - NAG: enables application security and compliance checks
#				 default: false

AWS_PROFILE_FLAG = --profile $(AWS_PROFILE)
STACK 				  ?= IVSRealTimeDemo
NAG							?= false
CDK_OPTIONS 		 = $(if $(AWS_PROFILE),$(AWS_PROFILE_FLAG)) \
									 --context stackName=$(STACK) \
									 --context nag=$(NAG)

DEFAULT_SCRIPT_OPTIONS = $(if $(AWS_PROFILE),$(AWS_PROFILE_FLAG)) \
									 			 --stackName $(STACK)

# Seeder options
COUNT						?= 1
TYPE						?= video

help: ## Shows this help message
	@echo "\n$$(tput bold)Available Rules:$$(tput sgr0)\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST)\
	 | sort \
	 | awk  \
	 'BEGIN {FS = ":.*?## "}; \
	 {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo "\n$$(tput bold)IMPORTANT!$$(tput sgr0)\n"
	@echo "If AWS_PROFILE is not exported as an environment variable or provided through the command line, then the default AWS profile is used. \n" | fold -s
	@echo "   Option 1: export AWS_PROFILE=user1\n"
	@echo "   Option 2: make <target> AWS_PROFILE=user1\n"

app: install bootstrap deploy ## Installs NPM dependencies, bootstraps, and deploys the stack

install: ## Installs NPM dependencies
	@echo "⚙️ Installing NPM dependencies..."
	npm install

bootstrap: ## Deploys the CDK Toolkit staging stack
	@echo "🥾 Bootstrapping..."
	npx cdk bootstrap $(CDK_OPTIONS)

synth: ## Synthesizes the CDK app and produces a cloud assembly in cdk.out
	@echo "🧪 Synthesizing..."
	npx cdk synth $(STACK) $(CDK_OPTIONS)

deploy: ## Deploys the stack
	@echo "🚀 Deploying $(STACK)..."
	npx cdk deploy $(STACK) $(CDK_OPTIONS) --outputs-file temp_out.json
	@echo "🛠️  Running post-deploy tasks..."
	node scripts/post-deploy.js $(DEFAULT_SCRIPT_OPTIONS)
	@rm temp_out.json
	@echo "\n$$(tput bold) ✅ $(STACK) Deployed Successfully $$(tput sgr0)"

output: ## Retrieves the CloudFormation stack outputs
	@echo "🧲 Retrieving stack outputs for $(STACK)..."
	aws cloudformation describe-stacks --stack-name $(STACK) --query 'Stacks[].Outputs'

destroy: clean ## Destroys the stack and cleans up
	@echo "🧨 Destroying $(STACK)..."
	npx cdk destroy $(STACK) $(CDK_OPTIONS)

clean: ## Deletes the cloud assembly directory (cdk.out)
	@echo "🧹 Cleaning..."
	rm -rf cdk.out

seed: ## Creates a specified number of randomly generated demo records
	@echo "🌱 Seeding..."
	node scripts/seed/seed.js $(DEFAULT_SCRIPT_OPTIONS) --count $(COUNT) --type $(TYPE)

publish: guard-FILE_ASSETS_BUCKET_NAME_PREFIX ## Publishes stack file assets to an S3 bucket and generate a launch stack URL
	@echo "🛠️  Preparing resources..."
	node scripts/publish/prepare.js $(DEFAULT_SCRIPT_OPTIONS) --fileAssetsBucketNamePrefix $(FILE_ASSETS_BUCKET_NAME_PREFIX)
	@echo "🧪 Synthesizing stack..."
	npx cdk synth $(STACK) $(CDK_OPTIONS) --context publish=true --quiet
	@echo "🚀 Publishing file assets..."
	npx cdk-assets publish --path cdk.out/$(STACK).assets.json
	@echo "\n$$(tput bold)✅ LAUNCH STACK URL: $$(tput sgr0)\n\
	\033[36m`node scripts/publish/generateLaunchStackUrl.js $(DEFAULT_SCRIPT_OPTIONS)`\033[0m"

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
		fi