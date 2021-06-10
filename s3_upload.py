#!/usr/bin/env python3

import sys
import os
import boto3
import random
import string
import datetime
import mimetypes

s3 = boto3.client(
    's3',
    aws_access_key_id=os.getenv('CLIPBOX_AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('CLIPBOX_AWS_SECRET_KEY')
    )

def rewrite_name(fname):
    """
    Some names are common enough that they're not
    worth including as part of the url.
    *-capture.png should be rewritten as just *.png
    """
    return (fname
        .replace('-capture.png', '.png')
        .replace('-recording.mp4', '.mp4')
        .replace('-clip.txt', '.txt'))

alphabet = string.ascii_letters + string.digits
def random_key(filename):
    prefix = ''.join(random.choice(alphabet) for _ in range(7))
    head, tail = os.path.split(filename)
    date = str(datetime.datetime.now())[:10]
    return rewrite_name('{}-{}-{}'.format(prefix, date, tail))

bucket_name = os.getenv('CLIPBOX_AWS_S3_BUCKET')
url_prefix = os.getenv('CLIPBOX_URL_PREFIX')

if __name__ == '__main__':
    file_name = sys.argv[1]
    obj_key = random_key(file_name)
    mtype, encoding = mimetypes.guess_type(file_name)
    s3.upload_file(
            file_name, bucket_name, obj_key,
            ExtraArgs={
                'ACL': 'public-read',
                'ContentType': mtype,
            })
    url = url_prefix + obj_key
    print(url)
