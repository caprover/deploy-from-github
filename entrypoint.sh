#!/bin/sh

if [ x$INPUT_IMAGE != x ]
then
  caprover deploy --caproverUrl $INPUT_SERVER --appToken $INPUT_TOKEN --appName $INPUT_APP -i $INPUT_IMAGE
elif [ x$INPUT_BRANCH != x ]
then
  caprover deploy --caproverUrl $INPUT_SERVER --appToken $INPUT_TOKEN --appName $INPUT_APP -b $INPUT_BRANCH
else
  caprover deploy --caproverUrl $INPUT_SERVER --appToken $INPUT_TOKEN --appName $INPUT_APP --tarFile ./deploy.tar
fi
